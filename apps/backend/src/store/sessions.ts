export interface Session {
  id: string;
  token: string;
  presenterSocketId: string | null;
  used: boolean;
  createdAt: number;
  expiresAt: number;
}

export const sessionStore = new Map<string, Session>();
export const tokenToSession = new Map<string, string>();

export function createSession(presenterSocketId: string): Session {
  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  const now = Date.now();

  const session: Session = {
    id,
    token,
    presenterSocketId,
    used: false,
    createdAt: now,
    expiresAt: now + Number(process.env.TOKEN_EXPIRY_MS ?? 300000),
  };

  sessionStore.set(id, session);
  tokenToSession.set(token, id);
  return session;
}

export function consumeToken(token: string): Session | null {
  const sessionId = tokenToSession.get(token);
  if (!sessionId) return null;

  const session = sessionStore.get(sessionId);
  if (!session || session.used || Date.now() > session.expiresAt) return null;

  session.used = true;
  tokenToSession.delete(token);
  return session;
}

export function getSession(sessionId: string): Session | undefined {
  return sessionStore.get(sessionId);
}

export function deleteSession(sessionId: string): boolean {
  const session = sessionStore.get(sessionId);
  if (session) {
    tokenToSession.delete(session.token);
    return sessionStore.delete(sessionId);
  }
  return false;
}
