<script lang="ts">
  import { page } from "$app/stores";
</script>

<main>
  <div class="card">
    <h1>🚀</h1>
    <p>Website Launched!</p>
    <p class="subtitle">Terima kasih sudah berpartisipasi</p>
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
  .subtitle {
    color: #64748b;
    font-size: 0.9rem;
  }
</style>
