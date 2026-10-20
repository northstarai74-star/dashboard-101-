import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { signInWithEnvAdmin } from "@/lib/admin-recovery";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";

const Body = z.object({ email: z.string().email().optional().or(z.literal("")), password: z.string().min(1), remember: z.boolean().optional() });

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60_000;

const DUMMY_HASH = "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";

async function verifyWithEmail(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  // Compare against a dummy hash when the user doesn't exist so timing doesn't reveal valid emails
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  return user && ok ? user : null;
}

/**
 * Email-less sign-in is for the owner only: the password is matched against admin accounts.
 * Team members always sign in with their email, so their passwords never have to be unique.
 */
async function verifyPasswordOnly(password: string) {
  const users = await db.user.findMany({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  let match: (typeof users)[number] | null = null;
  // Check every account (no early exit) so timing doesn't reveal which one matched
  for (const u of users) {
    if ((await bcrypt.compare(password, u.passwordHash)) && !match) match = u;
  }
  if (users.length === 0) await bcrypt.compare(password, DUMMY_HASH);
  return match;
}

async function handle(req: Request) {
  const ipKey = `login:ip:${clientIp(req)}`;
  const limited = await rateLimit(ipKey, MAX_ATTEMPTS, WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your password (and a valid email if you use one)" }, { status: 400 });

  const { email, password, remember } = parsed.data;
  const user =
    (await signInWithEnvAdmin(email, password)) ??
    (email ? await verifyWithEmail(email, password) : await verifyPasswordOnly(password));
  if (!user) {
    return NextResponse.json({ error: email ? "Incorrect email or password" : "Incorrect password. Team members: enter your email too." }, { status: 401 });
  }

  await resetRateLimit(ipKey);
  await createSession({ uid: user.id, role: user.role }, remember ?? true);
  return NextResponse.json({ ok: true });
}

/** Turns setup problems (missing secret, unmigrated database) into a readable JSON error instead of an empty 500. */
export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (err) {
    console.error("[login] failed", err);
    const msg = err instanceof Error ? err.message : "";
    const code = (err as { code?: string })?.code ?? "";
    let error = "Server error while signing in";
    if (msg.includes("SESSION_SECRET")) error = "Server setup incomplete: SESSION_SECRET is not set";
    else if (/^P(1|2021|2022)/.test(code) || /PrismaClientInitializationError/.test(String((err as Error)?.name)) || /DATABASE_URL/.test(msg))
      error = "Database isn't ready: check DATABASE_URL and run `npx prisma migrate deploy`";
    return NextResponse.json({ error }, { status: 500 });
  }
}
