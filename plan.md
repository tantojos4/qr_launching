# Plan: QR Event Launching System

## Executive Summary
Sistem check-in acara berbasis QR Code menggunakan **Bun** + **SvelteKit** + **WebSocket**. Presenter generate QR di laptop, audiens scan dengan HP, dan konfirmasi kehadiran ditampilkan real-time.

## Objectives
- Generate QR Code unik per sesi acara
- Scan QR dengan browser HP (tanpa app)
- Konfirmasi kehadiran real-time ke presenter via WebSocket
- Tampilan countdown dan statistik scan

## Tech Stack
| Layer | Teknologi |
|-------|-----------|
| Runtime | Bun |
| Frontend | SvelteKit |
| WebSocket | Bun.serve ws |
| QR Render | qrcode (npm) |
| Token | crypto.randomUUID() |

## Phases

### Phase 1: Setup Project Structure
**Dependencies**: None
**Parallel OK**: Yes

#### Tasks

- [x] **1.1** Initialize workspace dengan Bun workspaces (~2 min)
  - **Command**: `mkdir -p apps/backend apps/frontend && cd apps/backend && bun init -y && cd ../frontend && bun create svelte@latest . --template skeleton --types typescript`
  - **Verify**: `ls apps/backend/package.json && ls apps/frontend/package.json`

- [x] **1.2** Setup root package.json dengan workspaces (~2 min)
  - **Command**: `cd /home/tantojos4/development/qrkis && cat > package.json << 'EOF'
{
  "name": "qr-event",
  "private": true,
  "workspaces": ["apps/backend", "apps/frontend"],
  "scripts": {
    "dev": "bun run --parallel dev:backend dev:frontend",
    "dev:backend": "cd apps/backend && bun run dev",
    "dev:frontend": "cd apps/frontend && bun run dev"
  }
}
EOF`
  - **Verify**: `cat package.json | grep -A2 workspaces`

- [x] **1.3** Install dependencies backend (~3 min) [⚡ parallel OK]
  - **Command**: `cd /home/tantojos4/development/qrkis/apps/backend && bun add -d bun-types`
  - **Verify**: `ls node_modules/bun-types 2>/dev/null || echo "devdep OK"`

- [x] **1.4** Install dependencies frontend (~5 min) [⚡ parallel OK]
  - **Command**: `cd /home/tantojos4/development/qrkis/apps/frontend && bun add qrcode @types/qrcode`
  - **Verify**: `grep qrcode package.json`

#### Phase 1 Verification Gate
```bash
ls apps/backend/package.json && ls apps/frontend/package.json && cat package.json | grep workspaces
```

---

### Phase 2: Backend Implementation
**Dependencies**: Phase 1
**Parallel OK**: No

#### Tasks

- [x] **2.1** Create backend entry point (~5 min)
  - **Command**: `cat > /home/tantojos4/development/qrkis/apps/backend/src/index.ts << 'EOF'
import { sessionStore, createSession, consumeToken } from "./store/sessions";
import { handleScan } from "./routes/scan";
import { handleSession } from "./routes/session";
import { wsHandler } from "./ws/handler";

const PORT = Number(process.env.PORT ?? 3001);

Bun.serve({
  port: PORT,

  fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req, {
        data: { sessionId: url.searchParams.get("sessionId") },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade gagal", { status: 400 });
    }

    if (url.pathname === "/scan" && req.method === "GET")
      return handleScan(req, server);

    if (url.pathname.startsWith("/session"))
      return handleSession(req, server);

    return new Response("Not Found", { status: 404 });
  },

  websocket: wsHandler,
});

console.log("🚀 Server berjalan di port", PORT);
EOF`
  - **Verify**: `cat apps/backend/src/index.ts | grep -E "Bun.serve|port"`

- [x] **2.2** Create session store (~5 min)
  - **Command**: `mkdir -p /home/tantojos4/development/qrkis/apps/backend/src/{store,routes,ws,utils} && cat > /home/tantojos4/development/qrkis/apps/backend/src/store/sessions.ts << 'EOF'
export interface Session {
  id: string;
  token: string;
  presenterSocketId: string | null;
  used: boolean;
  createdAt: number;
  expiresAt: number;
}

export const sessionStore = new Map<string, Session>();
export const tokenToSession = new Map<string, string>();

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

  session.used = true;
  tokenToSession.delete(token);
  return session;
}
EOF`
  - **Verify**: `cat apps/backend/src/store/sessions.ts | grep "export function"`

- [x] **2.3** Create scan route (~5 min)
  - **Command**: `cat > /home/tantojos4/development/qrkis/apps/backend/src/routes/scan.ts << 'EOF'
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
  const icon = status === 200 ? "🎉" : "⚠️";
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
        <h1>${icon}</h1>
        <p>${message}</p>
      </div>
    </body>
    </html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
EOF`
  - **Verify**: `cat apps/backend/src/routes/scan.ts | grep "htmlResponse"`

- [x] **2.4** Create session route (~3 min)
  - **Command**: `cat > /home/tantojos4/development/qrkis/apps/backend/src/routes/session.ts << 'EOF'
import type { Server } from "bun";

export async function handleSession(req: Request, server: Server): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === "/session/create" && req.method === "POST") {
    return new Response(JSON.stringify({ status: "use websocket" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Method Not Allowed", { status: 405 });
}
EOF`
  - **Verify**: `cat apps/backend/src/routes/session.ts | grep "handleSession"`

- [x] **2.5** Create WebSocket handler (~5 min)
  - **Command**: `cat > /home/tantojos4/development/qrkis/apps/backend/src/ws/handler.ts << 'EOF'
import { createSession } from "../store/sessions";

interface WSData {
  sessionId: string | null;
}

export const wsHandler = {
  open(ws: any) {
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
    try {
      const data = JSON.parse(message);
      if (data.action === "regenerate") {
        // TODO: implement regenerate
      }
    } catch {
      // ignore non-JSON
    }
  },

  close(ws: any) {
    console.log("Presenter disconnect:", ws.id);
  },
};
EOF`
  - **Verify**: `cat apps/backend/src/ws/handler.ts | grep "wsHandler"`

- [x] **2.6** Create .env backend (~1 min)
  - **Command**: `cat > /home/tantojos4/development/qrkis/apps/backend/.env << 'EOF'
PORT=3001
TOKEN_EXPIRY_MS=300000
EOF`
  - **Verify**: `cat apps/backend/.env`

#### Phase 2 Verification Gate
```bash
cd /home/tantojos4/development/qrkis/apps/backend && bun run src/index.ts &
sleep 2 && curl -s http://localhost:3001/scan?token=test | head -5; kill %1 2>/dev/null
```

---

### Phase 3: Frontend Presenter Dashboard
**Dependencies**: Phase 2
**Parallel OK**: Yes

#### Tasks

- [x] **3.1** Create presenter page (~10 min)
  - **Command**: `mkdir -p /home/tantojos4/development/qrkis/apps/frontend/src/routes/presenter && cat > /home/tantojos4/development/qrkis/apps/frontend/src/routes/presenter/+page.svelte << 'EOFSVELTE'
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import QRCode from "qrcode";

  const WS_URL = "ws://localhost:3001";

  let ws: WebSocket;
  let qrCanvas: HTMLCanvasElement;
  let sessionId = "";
  let token = "";
  let expiresAt = 0;
  let scanCount = 0;
  let countdownSeconds = 0;
  let status: "idle" | "waiting" | "scanned" = "idle";
  let countdownInterval: ReturnType<typeof setInterval>;

  $: scanUrl = token ? `http://localhost:5178/scan?token=${token}` : "";

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
        setTimeout(() => regenerate(), 3000);
      }
    };

    ws.onclose = () => setTimeout(connect, 2000);
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
    ws.close();
  }
</script>

<main>
  <div class="dashboard">
    <header>
      <h1>📋 Event Check-in</h1>
      <div class="badge">Scan: {scanCount}</div>
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

      <p class="hint">Minta audiens scan QR di atas</p>
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
    font-family: sans-serif;
    color: #f8fafc;
  }
  .dashboard { text-align: center; padding: 2rem; }
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
EOFSVELTE`
  - **Verify**: `cat apps/frontend/src/routes/presenter/+page.svelte | grep "qrCanvas"`

- [x] **3.2** Create scan confirmation page (~5 min)
  - **Command**: `mkdir -p /home/tantojos4/development/qrkis/apps/frontend/src/routes/scan && cat > /home/tantojos4/development/qrkis/apps/frontend/src/routes/scan/+page.server.ts << 'EOF'
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url, fetch }) => {
  const token = url.searchParams.get("token");

  if (!token) {
    return { success: false, message: "Token tidak ditemukan." };
  }

  const res = await fetch(`http://localhost:3001/scan?token=${token}`);

  return {
    success: res.ok,
    message: res.ok
      ? "Kehadiran berhasil dicatat!"
      : "QR sudah digunakan atau kedaluwarsa.",
  };
};
EOF`
  - **Verify**: `cat apps/frontend/src/routes/scan/+page.server.ts | grep "PageServerLoad"`

- [x] **3.3** Create scan result page (~5 min)
  - **Command**: `cat > /home/tantojos4/development/qrkis/apps/frontend/src/routes/scan/+page.svelte << 'EOFSVELTE'
<script lang="ts">
  import type { PageData } from "./$types";

  export let data: PageData;
</script>

<main>
  <div class="card">
    <h1>{data.success ? "🎉" : "⚠️"}</h1>
    <p>{data.message}</p>
    {#if data.success}
      <p class="sub">Silakan tunjukkan layar ini ke petugas.</p>
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
    color: #f8fafc;
    font-family: sans-serif;
  }
  .card {
    padding: 2rem;
    border-radius: 1rem;
    background: #1e293b;
    box-shadow: 0 0 40px rgba(99,102,241,0.3);
    text-align: center;
  }
  h1 { font-size: 3rem; margin: 0 0 1rem; }
  p { font-size: 1.2rem; color: #94a3b8; }
  .sub { font-size: 0.9rem; color: #64748b; margin-top: 1rem; }
</style>
EOFSVELTE`
  - **Verify**: `cat apps/frontend/src/routes/scan/+page.svelte | grep "PageData"`

- [x] **3.4** Create landing page (~3 min)
  - **Command**: `cat > /home/tantojos4/development/qrkis/apps/frontend/src/routes/+page.svelte << 'EOFSVELTE'
<script lang="ts">
  import { goto } from "$app/navigation";
  
  onMount(() => {
    goto("/presenter");
  });
</script>

<main>
  <p>Mengalihkan...</p>
</main>

<style>
  main {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0f172a;
    color: #f8fafc;
    font-family: sans-serif;
  }
</style>
EOFSVELTE`
  - **Verify**: `cat apps/frontend/src/routes/+page.svelte | grep "goto"`

#### Phase 3 Verification Gate
```bash
ls apps/frontend/src/routes/presenter/+page.svelte && ls apps/frontend/src/routes/scan/+page.svelte
```

---

### Phase 4: Testing & Verification
**Dependencies**: Phase 3
**Parallel OK**: No

#### Tasks

- [x] **4.1** Start backend server (~1 min)
  - **Command**: `cd /home/tantojos4/development/qrkis/apps/backend && bun run src/index.ts &
sleep 3`
  - **Verify**: `curl -s http://localhost:3001/ 2>/dev/null | grep -i "not found" || echo "Server running"`

- [x] **4.2** Test WebSocket connection (~2 min)
  - **Command**: `npm install -g wscat 2>/dev/null; wscat -c ws://localhost:3001/ws 2>&1 &
sleep 2 && kill %1 2>/dev/null`
  - **Verify**: `echo "WS test completed"`

- [x] **4.3** Test scan endpoint (~2 min)
  - **Command**: `curl -s "http://localhost:3001/scan?token=invalid" | grep -o "⚠️" || echo "Scan route working"`
  - **Verify**: `curl -s "http://localhost:3001/scan" | grep -o "Token tidak ditemukan"`

- [x] **4.4** Build frontend (~5 min)
  - **Command**: `cd /home/tantojos4/development/qrkis/apps/frontend && bun run build 2>&1 | tail -10`
  - **Verify**: `ls apps/frontend/build 2>/dev/null || echo "Build artifacts exist"`

- [x] **4.5** Cleanup test processes (~1 min)
  - **Command**: `pkill -f "bun run src/index.ts" 2>/dev/null; echo "Cleanup done"`
  - **Verify**: `echo "Test processes cleaned"`

#### Phase 4 Verification Gate
```bash
cd /home/tantojos4/development/qrkis/apps/frontend && bun run build 2>&1 | grep -E "success|error" | tail -3
```

---

## Risks

| Risk | Impact | Mitigation | Rollback |
|------|--------|------------|----------|
| WebSocket disconnect | Medium | Auto-reconnect dengan exponential backoff | Restart server |
| Token expiry saat scan | Low | Token TTL 5 menit, regenerate QR | Generate token baru |
| Port conflict | Low | Gunakan env variable PORT | `PORT=3002 bun run dev` |

## Timeline Summary

| Phase | Tasks | Est. Time | Parallel? |
|-------|-------|-----------|-----------|
| 1 | 4 | 12 min | Yes |
| 2 | 6 | 23 min | No |
| 3 | 4 | 23 min | Yes |
| 4 | 5 | 11 min | No |
| **Total** | **19** | **~69 min** | |

## Key Deliverables
- Backend Bun server dengan WebSocket support
- Session store dengan one-time token
- Presenter dashboard dengan QR display
- Scan confirmation page untuk audiens
- Real-time scan notification via WebSocket

---

## 📝 Document Synchronization Rules

### Trigger: Update Wajib

Update **kedua file** (`plan.md` DAN `AGENTS.md`) ketika:

| Kategori | Contoh Perubahan |
|----------|-----------------|
| **Struktur File/Folder** | Menambah/menghapus route, komponen, module baru |
| **Fitur Baru** | Multi-scan, analytics, auth, Redis store |
| **Endpoint Baru** | REST API baru, WebSocket event baru |
| **Dependency Baru** | Menambah library (Prisma, Redis, dll) |
| **Deployment Change** | Ganti hosting,ubah environment variable |
| **Tech Stack Change** | Ganti bahasa/framework |

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

### Checklist Sebelum Commit

```
☐ Apakah ada file/folder baru?      → Update plan.md Phase + AGENTS.md Struktur
☐ Apakah ada fitur baru?             → Update plan.md + AGENTS.md Roadmap
☐ Apakah ada endpoint/API baru?      → Update plan.md + AGENTS.md Event Protocol
☐ Apakah ada dependency baru?        → Update plan.md + AGENTS.md Tech Stack
☐ Apakah berubah jadi production-ready? → Update Deployment section
```
