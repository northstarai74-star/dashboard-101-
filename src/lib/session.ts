import { SignJWT } from "jose";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "./db";
import { SESSION_COOKIE, loginDisabled, readSession, type SessionPayload } from "./token";

export { SESSION_COOKIE, loginDisabled, readSession };
export type { SessionPayload };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

/** `remember`: stay signed in for 30 days; otherwise the cookie ends with the browser session (token valid 1 day). */
export async function createSession(payload: SessionPayload, remember = true) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(remember ? "30d" : "1d")
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.APP_URL?.startsWith("https") === true,
    path: "/",
    ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Current user from the session cookie (server components / route handlers). */
// cache() dedupes the lookup across the layout, the page and any server component in one request.
export const getCurrentUser = cache(async () => {
  if (loginDisabled()) {
    return db.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, title: true, avatarColor: true },
    });
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await readSession(token);
  if (!session) return null;
  return db.user.findUnique({
    where: { id: session.uid },
    select: { id: true, name: true, email: true, role: true, title: true, avatarColor: true },
  });
});
