import { jwtVerify } from "jose";

// Kept free of database imports so the edge/proxy gate stays light: importing Prisma there made every request slow.
export const SESSION_COOKIE = "bos_session";

export type SessionPayload = { uid: string; role: string };

export async function readSession(token?: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return { uid: payload.uid as string, role: payload.role as string };
  } catch {
    return null;
  }
}

/** Local development only: DISABLE_LOGIN=true skips sign-in and uses the first admin. Never active in production. */
export function loginDisabled() {
  return process.env.NODE_ENV !== "production" && process.env.DISABLE_LOGIN === "true";
}
