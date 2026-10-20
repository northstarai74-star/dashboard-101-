import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import { db } from "./db";

// The team access code is the one secret a person needs to create a team-member account from the sign-in page.
// The owner sets it in Settings (stored as a bcrypt hash, never shown again) or with TEAM_SIGNUP_CODE in the environment.
// A code saved in Settings takes precedence over the environment variable.

const KEY = "teamSignupCodeHash";
export const MIN_CODE_LENGTH = 8;

function sameSecret(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function envCode() {
  const c = process.env.TEAM_SIGNUP_CODE?.trim();
  return c && c.length >= MIN_CODE_LENGTH ? c : null;
}

export type SignupCodeState = { enabled: boolean; source: "settings" | "env" | null };

export async function signupCodeState(): Promise<SignupCodeState> {
  if (await db.setting.findUnique({ where: { key: KEY } })) return { enabled: true, source: "settings" };
  return envCode() ? { enabled: true, source: "env" } : { enabled: false, source: null };
}

/** True when `given` matches the configured team access code. Always false when sign-up is switched off. */
export async function verifySignupCode(given: string) {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  if (row) return bcrypt.compare(given, row.value);
  const env = envCode();
  return env ? sameSecret(given, env) : false;
}

export async function setSignupCode(code: string) {
  const value = await bcrypt.hash(code, 10);
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}

/** Removes the code saved in Settings (an environment code, if any, applies again). */
export async function clearSignupCode() {
  await db.setting.deleteMany({ where: { key: KEY } });
}
