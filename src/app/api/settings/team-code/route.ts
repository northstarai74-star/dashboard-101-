import { z } from "zod";
import { json, route } from "@/lib/api";
import { MIN_CODE_LENGTH, clearSignupCode, setSignupCode, signupCodeState } from "@/lib/team-code";

const Body = z.object({ code: z.string().trim().min(MIN_CODE_LENGTH, `The code must be at least ${MIN_CODE_LENGTH} characters`).max(100) });

/** The code itself is write-only: it is stored hashed and never returned. */
export const GET = route(async () => json(await signupCodeState()), { admin: true });

export const PUT = route(
  async (req) => {
    await setSignupCode(Body.parse(await req.json()).code);
    return json(await signupCodeState());
  },
  { admin: true },
);

export const DELETE = route(
  async () => {
    await clearSignupCode();
    return json(await signupCodeState());
  },
  { admin: true },
);
