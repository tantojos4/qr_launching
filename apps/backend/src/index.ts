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

      if (!token) {
        return Response.redirect(`${FRONTEND_URL}/scan?error=missing_token`, 302);
      }

      const session = consumeToken(token);

      if (!session) {
        return Response.redirect(`${FRONTEND_URL}/scan?error=invalid_or_used`, 410);
      }

      server.publish(
        `session:${session.id}`,
        JSON.stringify({
          event: "scan:confirmed",
          sessionId: session.id,
          timestamp: Date.now(),
        })
      );

      return Response.redirect(`${FRONTEND_URL}/scan?sessionId=${session.id}&success=1`, 302);
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