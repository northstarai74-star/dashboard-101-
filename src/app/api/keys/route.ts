import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { addKey } from "@/lib/keys";
import { isHiggsfieldCredential } from "@/lib/higgsfield";

const Body = z.object({
  provider: z.enum(["META", "CLAUDE", "HIGGSFIELD"]),
  label: z.string().min(1, "Give the key a label"),
  secret: z.string().min(8, "That key looks too short"),
  priority: z.number().int().min(0).max(99).default(0),
});

// Secrets are write-only: responses never include the stored value, only the last 4 characters.
export const POST = route(
  async (req) => {
    const b = Body.parse(await req.json());
    if (b.provider === "HIGGSFIELD" && !isHiggsfieldCredential(b.secret.trim())) {
      return json({ error: "Higgsfield keys are entered as KEY_ID:KEY_SECRET" }, 400);
    }
    const k = await addKey(b.provider, b.label, b.secret.trim(), b.priority);
    return json({ id: k.id, provider: k.provider, label: k.label, keyHint: k.keyHint }, 201);
  },
  { admin: true },
);

export const GET = route(async () => {
  const keys = await db.apiKey.findMany({
    orderBy: [{ provider: "asc" }, { priority: "asc" }],
    select: { id: true, provider: true, label: true, keyHint: true, status: true, priority: true, usageCount: true, lastUsedAt: true, lastError: true },
  });
  return json(keys);
}, { admin: true });
