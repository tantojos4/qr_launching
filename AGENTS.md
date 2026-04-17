# agents.md — QR Event Launching System

> Real-time QR-based website launching system using **Bun** + **SvelteKit** + **WebSocket**.

---

## 🗺️ Arsitektur Sistem

```
┌─────────────────┐       WebSocket        ┌─────────────────┐       HTTP GET        ┌─────────────────┐
│  LAPTOP (Presenter)◄───────────────────►│  BACKEND SERVER │◄────────────────────│   HP AUDIENS    │
│  - Generate QR   │  (Session Room/Event) │  - Kelola Session│   (Scan Trigger)    │  - Buka URL QR  │
│  - Listen Event  │                       │  - Emit Signal   │                     │  - Auto-confirm │
│  - Countdown UI  │                       │  - One-time use  │                     │  - Terima kasih │
└─────────────────┘                       └─────────────────┘                     └─────────────────┘
```

### Alur Kerja

1. **Presenter** membuka dashboard → sistem generate `sessionId` + `token` unik
2. **QR Code** di-render di layar (encode URL: `https://domain.com/scan?token=<token>`)
3. **Audiens** scan QR → browser HP membuka URL → backend validasi token
4. **Backend** invalidasi token (one-time use) → emit event `scan:confirmed` via WebSocket
5. **Laptop** menerima event → tampilkan countdown / konfirmasi hadir
6. **HP Audiens** menerima response HTML → halaman "Terima Kasih"

---

## 📁 Struktur Proyek

```
qr-launching/
├── apps/
│   ├── backend/              # Bun HTTP + WebSocket server
│   │   ├── src/
│   │   │   ├── index.ts          # Entry point server
│   │   │   ├── routes/
│   │   │   │   ├── scan.ts       # GET /scan?token= handler
│   │   │   │   └── session.ts    # POST /session/create, DELETE /session/:id
│   │   │   ├── ws/
│   │   │   │   └── handler.ts    # WebSocket room manager
│   │   │   ├── store/
│   │   │   │   └── sessions.ts   # In-memory session store (Map)
│   │   │   └── utils/
│   │   │       ├── token.ts      # crypto.randomUUID() token generator
│   │   │       └── qr.ts         # QR URL builder
│   │   ├── package.json
│   │   └── bunfig.toml
│   │
│   └── frontend/             # SvelteKit app (Presenter + Audiens)
│       ├── src/
│       │   ├── routes/
│       │   │   ├── +layout.svelte
│       │   │   ├── +page.svelte          # Redirect / landing
│       │   │   ├── presenter/
│       │   │   │   └── +page.svelte      # Dashboard presenter (QR + countdown)
│       │   │   └── scan/
│       │   │       └── +page.server.ts   # Server-side token validation
│       │   │       └── +page.svelte      # Halaman "Terima Kasih" audiens
│       │   ├── lib/
│       │   │   ├── ws.ts                 # WebSocket client singleton
│       │   │   ├── qr.ts                 # QR code renderer (qrcode.js)
│       │   │   └── stores/
│       │   │       └── session.ts        # Svelte writable stores
│       │   └── app.html
│       ├── package.json
│       └── svelte.config.js
│
├── package.json              # Bun workspace root
└── agents.md                 # File ini
```

---

## 🛠️ Tech Stack

| Layer | Teknologi | Alasan |
|---|---|---|
| Runtime | **Bun** | Native WebSocket, fast startup, built-in bundler |
| Frontend | **SvelteKit** | SSR untuk scan page, reaktif untuk countdown |
| WebSocket | **Bun.serve ws** | Built-in, tanpa library tambahan |
| QR Render | **qrcode** (npm) | Ringan, support canvas + SVG |
| Token | `crypto.randomUUID()` | Built-in Bun/Web API, tidak perlu UUID lib |
| Store | **In-memory Map** | Cukup untuk single-session event, zero DB |
| Styling | **CSS custom props** | Tanpa framework CSS, full control |

---

## 🚀 Setup & Instalasi

### Prasyarat

```bash
# Install Bun (jika belum ada)
curl -fsSL https://bun.sh/install | bash
```

### Clone & Install

```bash
git clone <repo-url> qr-launching
cd qr-launching

# Install semua workspace sekaligus
bun install
```

### Konfigurasi Environment

**`apps/backend/.env`**
```env
PORT=3001
WS_PORT=3001          # Bun serve gabung HTTP + WS di satu port
FRONTEND_URL=http://localhost:5173
TOKEN_EXPIRY_MS=300000  # 5 menit
```

**`apps/frontend/.env`**
```env
PUBLIC_BACKEND_URL=http://localhost:3001
PUBLIC_WS_URL=ws://localhost:3001
PUBLIC_FRONTEND_URL=http://localhost:5178
```

### Jalankan Development

```bash
# Dari root project — menjalankan backend + frontend secara parallel
bun run dev
```

Ini akan menjalankan:
- Backend: `http://localhost:3001` (HTTP + WebSocket di port yang sama)
- Frontend: `http://localhost:5178` (Vite dev server)

---

## 🔧 Implementasi Detail

### 1. Backend — `apps/backend/src/index.ts`

```typescript
import { sessionStore } from "./store/sessions";
import { handleScan } from "./routes/scan";
import { handleSession } from "./routes/session";
import { wsHandler } from "./ws/handler";

Bun.serve({
  port: process.env.PORT ?? 3001,

  fetch(req, server) {
    const url = new URL(req.url);

    // Upgrade ke WebSocket (untuk presenter laptop)
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req, {
        data: { sessionId: url.searchParams.get("sessionId") },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade gagal", { status: 400 });
    }

    // Route: Audiens scan QR
    if (url.pathname === "/scan" && req.method === "GET")
      return handleScan(req, server);

    // Route: Presenter kelola session
    if (url.pathname.startsWith("/session"))
      return handleSession(req, server);

    return new Response("Not Found", { status: 404 });
  },

  websocket: wsHandler,
});

console.log("🚀 Server berjalan di port", process.env.PORT ?? 3001);
```

---

### 2. Session Store — `apps/backend/src/store/sessions.ts`

```typescript
export interface Session {
  id: string;
  token: string;
  presenterSocketId: string | null;
  used: boolean;
  createdAt: number;
  expiresAt: number;
}

// In-memory store — cukup untuk satu event
export const sessionStore = new Map<string, Session>();
export const tokenToSession = new Map<string, string>(); // token → sessionId

export function createSession(presenterSocketId: string): Session {
  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  const now = Date.now();

  const session: Session = {
    id,
    token,
    presenterSocketId,
    used: false,
    createdAt: now,
    expiresAt: now + Number(process.env.TOKEN_EXPIRY_MS ?? 300000),
  };

  sessionStore.set(id, session);
  tokenToSession.set(token, id);
  return session;
}

export function consumeToken(token: string): Session | null {
  const sessionId = tokenToSession.get(token);
  if (!sessionId) return null;

  const session = sessionStore.get(sessionId);
  if (!session || session.used || Date.now() > session.expiresAt) return null;

  // One-time use: langsung invalidasi
  session.used = true;
  tokenToSession.delete(token);
  return session;
}
```

---

### 3. Scan Handler — `apps/backend/src/routes/scan.ts`

```typescript
import { consumeToken } from "../store/sessions";

export async function handleScan(req: Request, server: any): Promise<Response> {
  const token = new URL(req.url).searchParams.get("token");

  if (!token) {
    return htmlResponse("❌ Token tidak ditemukan.", 400);
  }

  const session = consumeToken(token);

  if (!session) {
    return htmlResponse("⚠️ QR sudah digunakan atau kedaluwarsa.", 410);
  }

  // Emit ke WebSocket presenter
  server.publish(
    `session:${session.id}`,
    JSON.stringify({
      event: "scan:confirmed",
      sessionId: session.id,
      timestamp: Date.now(),
    })
  );

  return htmlResponse("✅ Kehadiran dicatat! Terima kasih.", 200);
}

function htmlResponse(message: string, status: number): Response {
  return new Response(
    `<!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Konfirmasi Kehadiran</title>
      <style>
        body { font-family: sans-serif; display: flex; align-items: center;
               justify-content: center; min-height: 100vh; margin: 0;
               background: #0f172a; color: #f8fafc; text-align: center; }
        .card { padding: 2rem; border-radius: 1rem; background: #1e293b;
                box-shadow: 0 0 40px rgba(99,102,241,0.3); }
        h1 { font-size: 3rem; margin: 0 0 1rem; }
        p  { font-size: 1.2rem; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>${status === 200 ? "🎉" : "⚠️"}</h1>
        <p>${message}</p>
      </div>
    </body>
    </html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
```

---

### 4. WebSocket Handler — `apps/backend/src/ws/handler.ts`

```typescript
import { createSession } from "../store/sessions";

interface WSData {
  sessionId: string | null;
}

export const wsHandler = {
  open(ws: any) {
    // Presenter konek → buat session baru, subscribe ke room-nya
    const session = createSession(ws.id);
    ws.subscribe(`session:${session.id}`);

    ws.send(
      JSON.stringify({
        event: "session:created",
        sessionId: session.id,
        token: session.token,
        expiresAt: session.expiresAt,
      })
    );
  },

  message(ws: any, message: string) {
    // Bisa extend: presenter kirim perintah regenerate token, dll
    try {
      const data = JSON.parse(message);
      if (data.action === "regenerate") {
        // TODO: buat token baru untuk session yang sama
      }
    } catch {
      // abaikan pesan non-JSON
    }
  },

  close(ws: any) {
    // Cleanup otomatis saat presenter disconnect
    console.log("Presenter disconnect:", ws.id);
  },
};
```

---

### 5. Frontend Presenter — `src/routes/presenter/+page.svelte`

```svelte
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { writable } from "svelte/store";
  import QRCode from "qrcode";

  const WS_URL = import.meta.env.PUBLIC_WS_URL;
  const FRONTEND_URL = import.meta.env.PUBLIC_FRONTEND_URL ?? window.location.origin;

  let ws: WebSocket;
  let qrCanvas: HTMLCanvasElement;
  let sessionId = "";
  let token = "";
  let expiresAt = 0;
  let scanCount = 0;
  let countdownSeconds = 0;
  let status: "idle" | "waiting" | "scanned" = "idle";
  let countdownInterval: ReturnType<typeof setInterval>;

  // Derived scan URL
  $: scanUrl = token ? `${FRONTEND_URL}/scan?token=${token}` : "";

  onMount(() => {
    connect();
  });

  onDestroy(() => {
    ws?.close();
    clearInterval(countdownInterval);
  });

  function connect() {
    ws = new WebSocket(`${WS_URL}/ws`);

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.event === "session:created") {
        sessionId = data.sessionId;
        token = data.token;
        expiresAt = data.expiresAt;
        status = "waiting";
        startCountdown();
        renderQR();
      }

      if (data.event === "scan:confirmed") {
        scanCount++;
        status = "scanned";
        clearInterval(countdownInterval);
        // Reset setelah 3 detik untuk QR berikutnya
        setTimeout(() => regenerate(), 3000);
      }
    };

    ws.onclose = () => setTimeout(connect, 2000); // auto-reconnect
  }

  async function renderQR() {
    if (!qrCanvas || !scanUrl) return;
    await QRCode.toCanvas(qrCanvas, scanUrl, {
      width: 280,
      margin: 2,
      color: { dark: "#f8fafc", light: "#1e293b" },
    });
  }

  function startCountdown() {
    clearInterval(countdownInterval);
    countdownSeconds = Math.floor((expiresAt - Date.now()) / 1000);
    countdownInterval = setInterval(() => {
      countdownSeconds--;
      if (countdownSeconds <= 0) {
        clearInterval(countdownInterval);
        status = "idle";
      }
    }, 1000);
  }

  function regenerate() {
    // Tutup dan reconnect untuk session + token baru
    ws.close();
  }
</script>

<main>
  <div class="dashboard">
    <header>
      <h1>🚀 Website Launching</h1>
      <div class="badge">Launch: {scanCount}</div>
    </header>

    {#if status === "waiting" || status === "scanned"}
      <div class="qr-wrapper" class:scanned={status === "scanned"}>
        <canvas bind:this={qrCanvas}></canvas>
        {#if status === "scanned"}
          <div class="overlay">✅ Dicatat!</div>
        {/if}
      </div>

      <div class="countdown" class:urgent={countdownSeconds < 30}>
        ⏱ Kedaluwarsa dalam {countdownSeconds}s
      </div>

      <p class="hint">Minta audiens scan QR untuk launch website</p>
    {:else}
      <div class="idle">Menghubungkan ke server...</div>
    {/if}
  </div>
</main>

<style>
  main {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0f172a;
    font-family: "IBM Plex Mono", monospace;
    color: #f8fafc;
  }
  .dashboard {
    text-align: center;
    padding: 2rem;
  }
  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 2rem;
  }
  h1 { margin: 0; font-size: 1.8rem; }
  .badge {
    background: #6366f1;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-size: 0.9rem;
  }
  .qr-wrapper {
    position: relative;
    display: inline-block;
    border-radius: 1rem;
    overflow: hidden;
    box-shadow: 0 0 60px rgba(99,102,241,0.4);
    transition: box-shadow 0.3s;
  }
  .qr-wrapper.scanned {
    box-shadow: 0 0 60px rgba(34,197,94,0.6);
  }
  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(15,23,42,0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    font-weight: bold;
    color: #4ade80;
  }
  .countdown {
    margin-top: 1rem;
    font-size: 1rem;
    color: #94a3b8;
    transition: color 0.3s;
  }
  .countdown.urgent { color: #f87171; }
  .hint { color: #475569; font-size: 0.85rem; margin-top: 0.5rem; }
  .idle { color: #475569; font-size: 1.2rem; }
</style>
```

---

### 6. Frontend Scan — `src/routes/scan/+page.server.ts`

```typescript
// Server-side: SvelteKit load function untuk halaman audiens
// Backend sudah handle response HTML langsung dari Bun,
// tapi jika ingin SvelteKit handle:

import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url, fetch }) => {
  const token = url.searchParams.get("token");

  if (!token) {
    return { success: false, message: "Token tidak ditemukan." };
  }

  // Forward ke backend Bun
  const res = await fetch(
    `${process.env.BACKEND_URL}/scan?token=${token}`
  );

  return {
    success: res.ok,
    message: res.ok
      ? "Kehadiran berhasil dicatat!"
      : "QR sudah digunakan atau kedaluwarsa.",
  };
};
```

---

## 📦 Package JSON

### Root — `package.json`

```json
{
  "name": "qr-launching",
  "private": true,
  "workspaces": ["apps/backend", "apps/frontend"],
  "scripts": {
    "dev": "bun run --parallel dev:backend dev:frontend",
    "dev:backend": "cd apps/backend && bun run dev",
    "dev:frontend": "cd apps/frontend && bun run dev",
    "build": "bun run --parallel build:backend build:frontend"
  }
}
```

### Backend — `apps/backend/package.json`

```json
{
  "name": "qr-launching-backend",
  "scripts": {
    "dev": "bun --hot src/index.ts",
    "start": "bun src/index.ts"
  },
  "dependencies": {}
}
```

### Frontend — `apps/frontend/package.json`

```json
{
  "name": "qr-launching-frontend",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "@sveltejs/adapter-auto": "^3.0.0",
    "@sveltejs/kit": "^2.0.0",
    "svelte": "^5.0.0",
    "vite": "^5.0.0"
  },
  "dependencies": {
    "qrcode": "^1.5.3"
  }
}
```

---

## 🔄 Event Protocol (WebSocket)

| Direction | Event | Payload |
|---|---|---|
| Server → Presenter | `session:created` | `{ sessionId, token, expiresAt }` |
| Server → Presenter | `scan:confirmed` | `{ sessionId, timestamp }` |
| Presenter → Server | `regenerate` | `{ sessionId }` |

---

## 🔐 Keamanan Token

- Token adalah `crypto.randomUUID()` — 36 karakter UUID v4, ~122 bit entropy
- **One-time use**: setelah di-scan, langsung dihapus dari Map
- **TTL**: default 5 menit, dikonfigurasi via `TOKEN_EXPIRY_MS`
- **No DB**: semua di memory → tidak ada persistence issue
- **CORS**: tambahkan header `Access-Control-Allow-Origin` jika frontend dan backend beda domain

---

## 🚢 Deployment

### Backend (Bun)

```bash
# Build single binary (opsional)
bun build apps/backend/src/index.ts --outfile dist/server --target bun

# Atau langsung run
bun apps/backend/src/index.ts
```

### Frontend (SvelteKit)

```bash
cd apps/frontend
bun run build
# Deploy dist/ ke Vercel / Netlify / Node adapter
```

### Rekomendasi Hosting

| Service | Backend | Frontend |
|---|---|---|
| **Railway** | ✅ Support Bun native | — |
| **Fly.io** | ✅ Docker + Bun | — |
| **Vercel** | ❌ Serverless (no WS) | ✅ |
| **Netlify** | ❌ No WS | ✅ |
| **VPS (Hetzner/DO)** | ✅ Full control | ✅ |

> **Rekomendasi**: Backend di **Railway** atau **VPS**, Frontend di **Vercel**.

---

## 🧪 Testing Manual

```bash
# 1. Jalankan backend
bun apps/backend/src/index.ts

# 2. Konek WebSocket (simulasi presenter)
wscat -c ws://localhost:3001/ws
# → terima event session:created dengan token

# 3. Simulasi scan dari HP
curl "http://localhost:3001/scan?token=<TOKEN_DARI_WS>"
# → response HTML "Terima Kasih"

# 4. Cek di wscat → event scan:confirmed diterima presenter
```

---

## 📋 Roadmap Opsional

- [ ] **Multi-scan**: hapus one-time restriction, track jumlah scan per session
- [ ] **Multi-launch**: track jumlah website launched per session
- [ ] **Analytics dashboard**: statistik launch real-time
- [ ] **Redis store**: ganti in-memory Map agar survive restart
- [ ] **QR Refresh otomatis**: generate token baru setiap N detik tanpa reconnect WS
- [ ] **Auth presenter**: password sederhana agar hanya presenter yang bisa buka dashboard

---

## 🔄 Document Synchronization Rules

### Mandate

**Gunakan aturan ini ketika mengimplementasikan fitur baru atau mengubah struktur proyek.**

### Trigger: Update Wajib

Update **kedua file** (`plan.md` DAN `AGENTS.md`) ketika:

| Kategori | Contoh Perubahan |
|----------|-----------------|
| **Struktur File/Folder** | Menambah/menghapus route, komponen, module baru |
| **Fitur Baru** | Multi-scan, analytics, auth, Redis store |
| **Endpoint Baru** | REST API baru, WebSocket event baru |
| **Dependency Baru** | Menambah library (Prisma, Redis, dll) |
| **Deployment Change** | Ganti hosting,ubah environment variable |
| **Tech Stack Change** |替换语言/框架 |

### Aturan Spesifik

#### 1. Fitur Baru Ditambahkan
- **plan.md**: Tambah task baru di Phase yang sesuai, atau Phase baru
- **AGENTS.md**: Tambah di "Roadmap Opsional" atau section baru

#### 2. Struktur File Berubah
- **plan.md**: Update "Tasks" dengan file baru
- **AGENTS.md**: Update "📁 Struktur Proyek" diagram

#### 3. Tech Stack Berubah
- **plan.md**: Update Tech Stack table
- **AGENTS.md**: Update both Tech Stack and implementation code blocks

#### 4. Bug Fix / Refactor (TIDAK perlu update)
- Tidak perlu update plan.md atau AGENTS.md untuk:
  - Rename variabel internal
  - Perbaiki styling tanpa dampak UX
  - Refactor code yang tidak mengubah API/interface
  - Comment/outdated documentation fix

### Format Commit untuk Sync

```
docs: update plan.md and AGENTS.md for [perubahan]
```

Contoh:
```
docs: update plan.md and AGENTS.md for Redis store integration
feat: update plan.md and AGENTS.md for multi-scan feature
```

### Checklist Sebelum Commit

```
☐ Apakah ada file/folder baru?      → Update plan.md Phase + AGENTS.md Struktur
☐ Apakah ada fitur baru?             → Update plan.md + AGENTS.md Roadmap
☐ Apakah ada endpoint/API baru?      → Update plan.md + AGENTS.md Event Protocol
☐ Apakah ada dependency baru?        → Update plan.md + AGENTS.md Tech Stack
☐ Apakah berubah jadi production-ready? → Update Deployment section
```
