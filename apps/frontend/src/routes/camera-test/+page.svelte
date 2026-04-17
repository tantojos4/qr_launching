<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  let video: HTMLVideoElement;
  let status: "idle" | "scanning" | "found" = "idle";
  let errorMessage = "";
  let stream: MediaStream | null = null;

  onMount(() => {
    startCamera();
  });

  onDestroy(() => {
    stopCamera();
  });

  async function startCamera() {
    status = "scanning";
    errorMessage = "";

    try {
      console.log("Requesting camera...");
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      console.log("Camera granted:", stream);

      if (!video) {
        throw new Error("Video element tidak ditemukan");
      }

      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => {
          console.log("Video loaded, playing...");
          video.play().then(resolve).catch(reject);
        };
        video.onerror = () => reject(new Error("Video error"));
      });

      console.log("Camera ready!");
    } catch (err) {
      console.error("Camera error:", err);
      status = "idle";
      errorMessage = `Error: ${err instanceof Error ? err.message : "Unknown error"}`;
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
  }
</script>

<main>
  <div class="scanner">
    <h1>📷 Test Kamera</h1>
    {#if status === "scanning"}
      <p>Kamera aktif! Arahkan ke QR code.</p>
      <div class="video-wrapper">
        <video bind:this={video} muted playsinline autoplay></video>
      </div>
      <p class="hint">Jika QR terdeteksi, akan redirect otomatis</p>
    {:else}
      <p class="error">{errorMessage || "Kamera tidak aktif"}</p>
      <button onclick={() => startCamera()}>Start Kamera</button>
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
  .scanner {
    text-align: center;
    padding: 2rem;
    max-width: 600px;
    width: 100%;
  }
  h1 { margin: 0 0 1rem; font-size: 1.5rem; }
  p { color: #94a3b8; margin-bottom: 1.5rem; }
  .video-wrapper {
    border-radius: 1rem;
    overflow: hidden;
    box-shadow: 0 0 60px rgba(99, 102, 241, 0.4);
    margin-bottom: 1rem;
  }
  video {
    display: block;
    width: 100%;
    max-width: 500px;
    border-radius: 1rem;
  }
  .error { color: #f87171; }
  .hint { font-size: 0.85rem; }
  button {
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    border: none;
    background: #6366f1;
    color: #f8fafc;
    font-size: 1rem;
    cursor: pointer;
  }
</style>
