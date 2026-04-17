import { handleScan } from "./routes/scan";
import { handleSession } from "./routes/session";
import { wsHandler } from "./ws/handler";

Bun.serve({
  port: process.env.PORT ?? 3001,

  fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req, {
        data: { sessionId: url.searchParams.get("sessionId") },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade gagal", { status: 400 });
    }

    if (url.pathname === "/scan" && req.method === "GET") {
      return handleScan(req, server);
    }

    if (url.pathname.startsWith("/session")) {
      return handleSession(req, server);
    }

    return new Response("Not Found", { status: 404 });
  },

  websocket: wsHandler,
});

console.log("🚀 Server berjalan di port", process.env.PORT ?? 3001);
