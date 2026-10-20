import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { signupCodeState, verifySignupCode } from "@/lib/team-code";

const Body = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  code: z.string().min(1, "Enter the team access code"),
});

const COLORS = ["#ec4899", "#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#14b8a6"];
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60_000;

const fail = (error: string, status: number, headers?: HeadersInit) => NextResponse.json({ error }, { status, headers });

/** Creates a team-member account for anyone who knows the team access code. Always a MEMBER, never an admin. */
async function handle(req: Request) {
  const ipKey = `signup:ip:${clientIp(req)}`;
  const limited = await rateLimit(ipKey, MAX_ATTEMPTS, WINDOW_MS);
  if (!limited.ok) return fail("Too many attempts. Try again later.", 429, { "Retry-After": String(limited.retryAfter) });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "), 400);
  const { name, email, password, code } = parsed.data;

  if (!(await signupCodeState()).enabled) return fail("Team sign-up isn't open. Ask the owner for an account.", 403);
  if (!(await verifySignupCode(code))) return fail("That team access code isn't right", 403);

  const lower = email.toLowerCase();
  // The owner's address is reserved: signing in with ADMIN_PASSWORD there recovers the admin account.
  const ownerEmail = (process.env.ADMIN_EMAIL || "admin@vanita.local").trim().toLowerCase();
  if (lower === ownerEmail || (await db.user.findUnique({ where: { email: lower } }))) return fail("An account with that email already exists. Sign in instead.", 409);

  const count = await db.user.count();
  const user = await db.user.create({
    data: { name, email: lower, passwordHash: await bcrypt.hash(password, 10), role: "MEMBER", avatarColor: COLORS[count % COLORS.length] },
  });

  await resetRateLimit(ipKey);
  await createSession({ uid: user.id, role: user.role }, true);
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (err) {
    console.error("[signup] failed", err);
    return fail("Server error while creating the account", 500);
  }
}
