import { z } from "zod";
import { json } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";
import { channelCredentials, type ChannelId } from "@/lib/connections";
import { ingestMessage, PLATFORMS } from "@/lib/ingest";
import { safeEqual } from "@/lib/meta";

// Pushes an inbound inquiry into the Inquiries inbox. Used for LinkedIn (no open inbound DM API)
// and any automation tool (Zapier, Make, n8n). Callers are either signed in, or send the channel's
// ingest token as `Authorization: Bearer <token>`.

const Body = z.object({
  platform: z.enum(PLATFORMS),
  text: z.string().min(1).max(4000),
  name: z.string().max(200).optional(),
  handle: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  externalId: z.string().max(200).optional(),
  threadId: z.string().max(300).optional(),
  at: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: body.error.issues.map((i) => i.message).join("; ") }, 400);
  const b = body.data;

  if ((await getCurrentUser())?.role !== "ADMIN") {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
    const creds = await channelCredentials(b.platform as ChannelId);
    if (!creds.ingestToken || !token || !safeEqual(token, creds.ingestToken)) {
      return json({ error: "Unauthorized" }, 401);
    }
  }

  const who = b.name || b.handle || b.email || b.phone || "unknown";
  const msg = await ingestMessage({
    platform: b.platform,
    name: b.name || b.handle,
    handle: b.handle,
    email: b.email,
    phone: b.phone,
    text: b.text,
    externalId: b.externalId,
    threadId: b.threadId ?? `${b.platform.toLowerCase()}:${who}`,
    at: b.at ? new Date(b.at) : undefined,
  });
  return json({ ok: true, stored: msg !== null }, 201);
}
