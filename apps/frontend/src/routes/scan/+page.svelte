<script lang="ts">
  import { page } from "$app/stores";

  $: success = $page.url.searchParams.get("success") === "1";
  $: error = $page.url.searchParams.get("error");
  $: sessionId = $page.url.searchParams.get("sessionId");

  $: title = error ? "⚠️" : success ? "🎉" : "🚀";
  $: message = error === "missing_token" 
    ? "Token tidak ditemukan" 
    : error === "invalid_or_used" 
    ? "QR sudah digunakan atau kedaluwarsa" 
    : success 
    ? "Website Launched!" 
    : "Terima kasih sudah berpartisipasi";
</script>

<main>
  <div class="card" class:error class:success>
    <h1>{title}</h1>
    <p>{message}</p>
    {#if sessionId}
      <p class="session-id">Session: {sessionId}</p>
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
  .card {
    padding: 2rem;
    border-radius: 1rem;
    background: #1e293b;
    box-shadow: 0 0 40px rgba(99,102,241,0.3);
    text-align: center;
    transition: box-shadow 0.3s;
  }
  .card.success {
    box-shadow: 0 0 40px rgba(34,197,94,0.4);
  }
  .card.error {
    box-shadow: 0 0 40px rgba(248,113,113,0.4);
  }
  h1 {
    font-size: 4rem;
    margin: 0 0 1rem;
  }
  p {
    font-size: 1.2rem;
    color: #94a3b8;
    margin: 0.5rem 0;
  }
  .session-id {
    color: #64748b;
    font-size: 0.8rem;
    font-family: monospace;
    margin-top: 1rem;
  }
</style>