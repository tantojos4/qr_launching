<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  onMount(() => {
    goto("/presenter");
  });
</script>

<main>
  <p>Redirecting to presenter dashboard...</p>
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
