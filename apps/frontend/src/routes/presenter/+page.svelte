<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import QRCode from "qrcode";

  const WS_URL = import.meta.env.PUBLIC_WS_URL || "ws://localhost:3001";
  const FRONTEND_URL = import.meta.env.PUBLIC_FRONTEND_URL ?? "http://localhost:5178";

  let ws: WebSocket;
  let qrCanvas: HTMLCanvasElement;
  let sessionId = "";
  let token = "";
  let expiresAt = 0;
  let scanCount = 0;
  let countdownSeconds = 0;
  let status: "idle" | "waiting" | "scanned" | "regenerating" = "idle";
  let countdownInterval: ReturnType<typeof setInterval>;
  let targetUrl = "";

  $: scanUrl = token && targetUrl ? `${FRONTEND_URL}/scan?token=${token}&target=${encodeURIComponent(targetUrl)}` : "";

  onMount(() => {
    console.log("WS_URL:", WS_URL);
    console.log("FRONTEND_URL:", FRONTEND_URL);
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
      console.log("WS message:", data);

      if (data.event === "session:created" || data.event === "token:regenerated") {
        console.log("Setting up session, token:", data.token);
        sessionId = data.sessionId;
        token = data.token;
        expiresAt = data.expiresAt;
        status = "waiting";
        startCountdown();
        const url = `${FRONTEND_URL}/scan?token=${token}`;
        console.log("Calling renderQR with:", url);
        tick().then(() => renderQR(url));
      }

      if (data.event === "scan:confirmed") {
        scanCount++;
        status = "scanned";
        clearInterval(countdownInterval);
        if (targetUrl && typeof window !== "undefined") {
          window.open(targetUrl, "_blank");
        }
        setTimeout(() => regenerate(), 3000);
      }
    };

    ws.onclose = () => {
      if (status !== "regenerating") {
        setTimeout(connect, 2000);
      }
    };
    ws.onerror = () => ws.close();
  }

  async function renderQR(url: string) {
    console.log("renderQR called, qrCanvas:", qrCanvas, "url:", url);
    if (!qrCanvas) {
      console.log("qrCanvas is null!");
      return;
    }
    try {
      await QRCode.toCanvas(qrCanvas, url, {
        width: 280,
        margin: 2,
        color: { dark: "#f8fafc", light: "#1e293b" },
      });
      console.log("QR rendered successfully!");
    } catch (err) {
      console.error("QR render error:", err);
    }
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
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      status = "idle";
      return;
    }

    status = "regenerating";
    ws.send(JSON.stringify({ action: "regenerate" }));
  }
</script>

<main>
  <div class="dashboard">
    <header>
      <h1>🚀 Website Launching</h1>
      <div class="badge">Launch: {scanCount}</div>
    </header>

    <div class="url-input">
      <input 
        type="url" 
        placeholder="Masukkan URL target (contoh: https://slamet.banyumaskab.go.id)"
        bind:value={targetUrl}
      />
    </div>

    {#if status === "waiting" || status === "scanned"}
      <div class="qr-wrapper" class:scanned={status === "scanned"}>
        <canvas bind:this={qrCanvas}></canvas>
        {#if status === "scanned"}
          <div class="overlay">✅ Website Launched!</div>
        {/if}
      </div>

      <div class="countdown" class:urgent={countdownSeconds < 30}>
        ⏱ {status === "scanned" ? "Reset..." : `Kedaluwarsa dalam ${countdownSeconds}s`}
      </div>

      <p class="hint">Tunjukkan layar ini ke kamera laptop untuk launch</p>
    {:else if status === "regenerating"}
      <div class="qr-wrapper">
        <canvas bind:this={qrCanvas}></canvas>
      </div>
      <div class="countdown">🔄 Regenerating token...</div>
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
    padding: 1rem;
  }
  .dashboard {
    text-align: center;
    padding: 1rem;
    width: 100%;
    max-width: 500px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }
  h1 { margin: 0; font-size: 1.5rem; }
  .badge {
    background: #6366f1;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-size: 0.85rem;
  }
  .url-input {
    margin-bottom: 1.5rem;
  }
  .url-input input {
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid #334155;
    background: #1e293b;
    color: #f8fafc;
    font-size: 1rem;
    width: 100%;
    max-width: 400px;
    text-align: center;
  }
  .url-input input:focus {
    outline: none;
    border-color: #6366f1;
  }
  .url-input input::placeholder {
    color: #64748b;
  }
  .qr-wrapper {
    position: relative;
    display: inline-block;
    border-radius: 1rem;
    overflow: hidden;
    box-shadow: 0 0 60px rgba(99,102,241,0.4);
    transition: box-shadow 0.3s;
    background: #1e293b;
    padding: 1rem;
  }
  .qr-wrapper.scanned {
    box-shadow: 0 0 60px rgba(34,197,94,0.6);
  }
  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(15,23,42,0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: bold;
    color: #4ade80;
  }
  .countdown {
    margin-top: 1rem;
    font-size: 0.9rem;
    color: #94a3b8;
    transition: color 0.3s;
  }
  .countdown.urgent { color: #f87171; }
  .hint { 
    color: #475569; 
    font-size: 0.8rem; 
    margin-top: 1rem;
    line-height: 1.4;
  }
  .idle { color: #475569; font-size: 1.2rem; }
  
  @media (max-width: 480px) {
    h1 { font-size: 1.2rem; }
    .qr-wrapper { padding: 0.5rem; }
    canvas { max-width: 280px !important; }
  }
</style>