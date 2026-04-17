<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Html5Qrcode } from "html5-qrcode";

  let scanner: Html5Qrcode | null = null;
  let status: "idle" | "scanning" | "found" = "idle";
  let errorMessage = "";
  let scanResult = "";
  let scannerReady = false;

  onMount(() => {
    scannerReady = true;
    startScanner();
  });

  onDestroy(() => {
    stopScanner();
  });

  async function startScanner() {
    if (!scannerReady) return;
    
    status = "scanning";
    errorMessage = "";

    try {
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for DOM
      
      const container = document.getElementById("scanner-container");
      if (!container) {
        throw new Error("Scanner container tidak ditemukan");
      }

      scanner = new Html5Qrcode("scanner-container");

      const devices = await Html5Qrcode.getCameras();
      
      if (!devices || devices.length === 0) {
        throw new Error("Tidak ada kamera ditemukan");
      }

      // Pilih kamera belakang jika ada
      const backCamera = devices.find(d => d.label.toLowerCase().includes("back")) || devices[0];

      await scanner.start(
        backCamera.id,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        onScanSuccess,
        onScanFailure
      );
    } catch (err) {
      console.error("Scanner error:", err);
      status = "idle";
      errorMessage = err instanceof Error ? err.message : "Kamera tidak dapat diakses";
    }
  }

  function stopScanner() {
    if (scanner) {
      scanner.stop().then(() => {
        scanner = null;
      }).catch(console.error);
    }
  }

  function onScanSuccess(decodedText: string) {
    console.log("QR found:", decodedText);
    status = "found";
    scanResult = decodedText;
    handleScan(decodedText);
  }

  function onScanFailure(error: any) {
    // Ignore scanning failures - ini normal saat belum detect QR
    // console.warn("Scan failure:", error);
  }

  function handleScan(data: string) {
    try {
      const url = new URL(data);
      const token = url.searchParams.get("token");
      const target = url.searchParams.get("target");

      if (target) {
        // Notify backend untuk track
        fetch(`http://localhost:3001/api/scan?token=${token}&target=${encodeURIComponent(target)}`)
          .then(() => {
            // Redirect laptop ke target
            window.open(target, "_blank");
          })
          .catch((err) => {
            console.error("Scan notify error:", err);
            window.open(target, "_blank");
          });
      }
    } catch (err) {
      console.error("Parse QR error:", err);
      // Jika bukan URL valid, coba buka langsung
      window.open(data, "_blank");
    }
  }
</script>

<main>
  <div class="scanner">
    <h1>📷 QR Scanner</h1>
    {#if status === "scanning"}
      <p>Arahkan kamera ke QR code di HP</p>
      <div id="scanner-container" class="scanner-container"></div>
    {:else if status === "found"}
      <div class="success">
        <h2>✅ QR Terdeteksi!</h2>
        <p>Membuka website...</p>
      </div>
    {:else}
      <p class="error">{errorMessage || "Kamera tidak dapat diakses."}</p>
      <button onclick={() => startScanner()}>Coba Lagi</button>
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
  h1 {
    margin: 0 0 1rem;
    font-size: 1.5rem;
  }
  p {
    color: #94a3b8;
    margin-bottom: 1.5rem;
  }
  .scanner-container {
    width: 100%;
    max-width: 500px;
    margin: 0 auto;
    border-radius: 1rem;
    overflow: hidden;
    box-shadow: 0 0 60px rgba(99, 102, 241, 0.4);
  }
  .scanner-container video {
    width: 100%;
    border-radius: 1rem;
  }
  .success {
    padding: 3rem;
    background: #1e293b;
    border-radius: 1rem;
    box-shadow: 0 0 60px rgba(34, 197, 94, 0.4);
  }
  .success h2 {
    margin: 0 0 1rem;
    font-size: 2rem;
  }
  .error {
    color: #f87171;
  }
  button {
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    border: none;
    background: #6366f1;
    color: #f8fafc;
    font-size: 1rem;
    cursor: pointer;
  }
  button:hover {
    background: #4f46e5;
  }
</style>
