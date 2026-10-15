import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { json } from "@/lib/api";
import { MetricInput, upsertMetric } from "@/lib/analytics";

// Machine ingest for automations (n8n, Make, Zapier, cron jobs reading WhatsApp / YouTube / LinkedIn / email / GA exports).
// Auth: `Authorization: Bearer $CRON_SECRET`. Body: one metric or an array of them.
const Body = z.union([MetricInput, z.array(MetricInput).max(500)]);

function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16 || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(req: Request) {
  if (!authorized(req.headers.get("authorization"))) return json({ error: "Unauthorized" }, 401);
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
    const items = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
    const results = [];
    for (const item of items) results.push(await upsertMetric({ ...item, source: item.source ?? "api" }));
    return json({ saved: results.length });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Server error" }, 400);
  }
}
