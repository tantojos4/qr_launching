import { createSession } from "../store/sessions";

export const wsHandler = {
  open(ws: any) {
    const session = createSession(ws.id);
    ws.subscribe(`session:${session.id}`);

    ws.send(
      JSON.stringify({
        event: "session:created",
        sessionId: session.id,
        token: session.token,
        expiresAt: session.expiresAt,
      })
    );
  },

  message(ws: any, message: string | Buffer) {
    try {
      const data = JSON.parse(message.toString());
      if (data.action === "regenerate") {
        // TODO: create new token for same session
      }
    } catch {
      // ignore non-JSON messages
    }
  },

  close(ws: any) {
    console.log("Presenter disconnect:", ws.id);
  },
};
