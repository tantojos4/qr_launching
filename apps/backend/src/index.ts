import "dotenv/config";
import { handleSession } from "./routes/session";
import { wsHandler } from "./ws/handler";
import { consumeToken, startPeriodicCleanup } from "./store/sessions";

const PORT = Number(process.env.PORT) || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:5173").split(",");

function corsHeaders(request: Request): Headers {
  const origin = request.headers.get("Origin");
  const headers = new Headers({
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin || "") ? origin! : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  return headers;
}

Bun.serve({
  port: PORT,

  fetch(req, server) {
    const url = new URL(req.url);
    const headers = corsHeaders(req);

    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req, {
        data: { sessionId: url.searchParams.get("sessionId") },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade gagal", { status: 400, headers });
    }

    if (url.pathname === "/scan" && req.method === "GET") {
      const token = url.searchParams.get("token");
      const targetUrl = url.searchParams.get("target");

      if (!token) {
        return new Response(`<!DOCTYPE html><html><body style="background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:sans-serif;text-align:center;"><div><h1>❌</h1><p>Token tidak ditemukan</p></div></body></html>`, {
          status: 400,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      const session = consumeToken(token);

      if (!session) {
        return new Response(`<!DOCTYPE html><html><body style="background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:sans-serif;text-align:center;"><div><h1>⚠️</h1><p>QR sudah digunakan atau kedaluwarsa</p></div></body></html>`, {
          status: 410,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      server.publish(
        `session:${session.id}`,
        JSON.stringify({
          event: "scan:confirmed",
          sessionId: session.id,
          timestamp: Date.now(),
          targetUrl: targetUrl,
        })
      );

      // HP dapat blank page dengan auto-close script
      return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OK</title></head><body style="margin:0;background:#0f172a"><script>setTimeout(()=>{try{window.close()}catch(e){}document.body.innerHTML=""},100)</script></body></html>`, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // API endpoint untuk laptop scanner notify scan
    if (url.pathname === "/api/scan" && req.method === "GET") {
      const token = url.searchParams.get("token");
      const targetUrl = url.searchParams.get("target");

      if (!token) {
        return new Response(JSON.stringify({ error: "Token tidak ditemukan" }), {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      const session = consumeToken(token);

      if (!session) {
        return new Response(JSON.stringify({ error: "QR sudah digunakan" }), {
          status: 410,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      // Notify semua client WebSocket
      server.publish(
        `session:${session.id}`,
        JSON.stringify({
          event: "scan:confirmed",
          sessionId: session.id,
          timestamp: Date.now(),
          targetUrl: targetUrl,
        })
      );

      return new Response(JSON.stringify({ success: true, targetUrl }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (url.pathname.startsWith("/session")) {
      return handleSession(req, server);
    }

    return new Response("Not Found", { status: 404, headers });
  },

  websocket: wsHandler,
});

console.log("🚀 Server berjalan di port", PORT);
console.log("📡 WebSocket ready at ws://localhost:", PORT, "/ws");
console.log("🌐 CORS allowed origins:", ALLOWED_ORIGINS.join(", "));

const cleanupTimer = startPeriodicCleanup(60000);
process.on("SIGINT", () => {
  clearInterval(cleanupTimer);
  process.exit(0);
});