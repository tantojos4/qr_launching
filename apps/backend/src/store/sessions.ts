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

const TOKEN_EXPIRY_MS = Number(process.env.TOKEN_EXPIRY_MS ?? 300000);

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
    expiresAt: now + TOKEN_EXPIRY_MS,
  };

  sessionStore.set(id, session);
  tokenToSession.set(token, id);
  return session;
}

export function regenerateToken(sessionId: string): Session | null {
  const session = sessionStore.get(sessionId);
  if (!session) return null;

  tokenToSession.delete(session.token);

  session.token = crypto.randomUUID();
  session.used = false;
  session.expiresAt = Date.now() + TOKEN_EXPIRY_MS;

  tokenToSession.set(session.token, sessionId);
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

export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [id, session] of sessionStore) {
    if (now > session.expiresAt) {
      tokenToSession.delete(session.token);
      sessionStore.delete(id);
      cleaned++;
    }
  }

  return cleaned;
}

export function startPeriodicCleanup(intervalMs: number = 60000): Timer {
  return setInterval(() => {
    const cleaned = cleanupExpiredSessions();
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired session(s)`);
    }
  }, intervalMs);
}