import type { Server } from "bun";
import { getSession, deleteSession } from "../store/sessions";

export async function handleSession(req: Request, server: Server): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;

  if (url.pathname === "/session" && method === "POST") {
    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.pathname.startsWith("/session/") && method === "DELETE") {
    const sessionId = url.pathname.split("/")[2];
    const deleted = deleteSession(sessionId);
    return new Response(JSON.stringify({ deleted }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.pathname.startsWith("/session/") && method === "GET") {
    const sessionId = url.pathname.split("/")[2];
    const session = getSession(sessionId);
    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(session), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Not Found", { status: 404 });
}
