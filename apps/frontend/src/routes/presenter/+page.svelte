<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import QRCode from "qrcode";

  const WS_URL = import.meta.env.PUBLIC_WS_URL;
  const FRONTEND_URL = import.meta.env.PUBLIC_FRONTEND_URL ?? "http://localhost:5173";

  let ws: WebSocket;
  let qrCanvas: HTMLCanvasElement;
  let sessionId = "";
  let token = "";
  let expiresAt = 0;
  let scanCount = 0;
  let countdownSeconds = 0;
  let status: "idle" | "waiting" | "scanned" = "idle";
  let countdownInterval: ReturnType<typeof setInterval>;

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
        setTimeout(() => regenerate(), 3000);
      }
    };

    ws.onclose = () => setTimeout(connect, 2000);
    ws.onerror = () => ws.close();
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
