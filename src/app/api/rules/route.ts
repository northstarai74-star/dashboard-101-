import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";

const Body = z.object({
  service: z.enum(["AI_VOICE", "WEB_DEV"]),
  agent: z.enum(["AI", "HUMAN"]),
  userId: z.string().nullable(),
});

/** Auto-assignment rule: where new leads of a service land by default. */
export const PUT = route(
  async (req) => {
    const b = Body.parse(await req.json());
    if (b.userId && !(await db.user.findUnique({ where: { id: b.userId }, select: { id: true } }))) {
      return json({ error: "Team member not found" }, 400);
    }
    const rule = await db.assignmentRule.upsert({
      where: { service: b.service },
      create: b,
      update: { agent: b.agent, userId: b.userId },
    });
    return json(rule);
  },
  { admin: true },
);
