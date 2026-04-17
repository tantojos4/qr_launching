import { createSession, regenerateToken } from "../store/sessions";

interface WSData {
  sessionId: string | null;
}

export const wsHandler = {
  open(ws: any) {
    const session = createSession(ws.id);
    (ws as any).sessionId = session.id;
    ws.subscribe(`session:${session.id}`);

    ws.send(
      JSON.stringify({
        event: "session:created",
        sessionId: session.id,
        token: session.token,
        expiresAt: session.expiresAt,
      })
    );

    console.log("Presenter connected:", ws.id, "session:", session.id);
  },

  message(ws: any, message: string | Buffer) {
    try {
      const data = JSON.parse(message.toString());

      if (data.action === "regenerate") {
        const sessionId = (ws as any).sessionId;
        if (!sessionId) {
          ws.send(JSON.stringify({ event: "error", message: "No session found" }));
          return;
        }

        const session = regenerateToken(sessionId);
        if (!session) {
          ws.send(JSON.stringify({ event: "error", message: "Session not found" }));
          return;
        }

        ws.send(
          JSON.stringify({
            event: "token:regenerated",
            sessionId: session.id,
            token: session.token,
            expiresAt: session.expiresAt,
          })
        );

        console.log("Token regenerated for session:", sessionId);
      }
    } catch {
      // ignore non-JSON messages
    }
  },

  close(ws: any) {
    const sessionId = (ws as any).sessionId;
    console.log("Presenter disconnected:", ws.id, "session:", sessionId);
  },
};