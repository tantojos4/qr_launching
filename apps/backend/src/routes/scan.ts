import { consumeToken } from "../store/sessions";

export async function handleScan(req: Request, server: any): Promise<Response> {
  const token = new URL(req.url).searchParams.get("token");

  if (!token) {
    return htmlResponse("❌ Token tidak ditemukan.", 400);
  }

  const session = consumeToken(token);

  if (!session) {
    return htmlResponse("⚠️ QR sudah digunakan atau kedaluwarsa.", 410);
  }

  server.publish(
    `session:${session.id}`,
    JSON.stringify({
      event: "scan:confirmed",
      sessionId: session.id,
      timestamp: Date.now(),
    })
  );

  return htmlResponse("✅ Kehadiran dicatat! Terima kasih.", 200);
}

function htmlResponse(message: string, status: number): Response {
  const emoji = status === 200 ? "🎉" : "⚠️";
  return new Response(
    `<!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Konfirmasi Kehadiran</title>
      <style>
        body { font-family: sans-serif; display: flex; align-items: center;
               justify-content: center; min-height: 100vh; margin: 0;
               background: #0f172a; color: #f8fafc; text-align: center; }
        .card { padding: 2rem; border-radius: 1rem; background: #1e293b;
                box-shadow: 0 0 40px rgba(99,102,241,0.3); }
        h1 { font-size: 3rem; margin: 0 0 1rem; }
        p  { font-size: 1.2rem; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>${emoji}</h1>
        <p>${message}</p>
      </div>
    </body>
    </html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
