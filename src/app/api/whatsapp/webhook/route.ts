import { NextResponse } from "next/server";
import { channelCredentials } from "@/lib/connections";
import { safeEqual, verifySignature } from "@/lib/meta";
import { ingestMessage } from "@/lib/ingest";

// Public endpoint (excluded from the login proxy). Protected by the verify token and Meta's HMAC signature.

type WaMessage = { from: string; id: string; timestamp?: string; type: string; text?: { body: string } };
type WaValue = { messages?: WaMessage[]; contacts?: { wa_id: string; profile?: { name?: string } }[] };
type WaPayload = { object?: string; entry?: { changes?: { field: string; value: WaValue }[] }[] };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const creds = await channelCredentials("WHATSAPP");
  if (
    url.searchParams.get("hub.mode") === "subscribe" &&
    creds.verifyToken &&
    safeEqual(url.searchParams.get("hub.verify_token"), creds.verifyToken)
  ) {
    return new NextResponse(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const creds = await channelCredentials("WHATSAPP");
  // Without the app secret we cannot prove the request came from Meta, so nothing is stored.
  if (!creds.appSecret || !verifySignature(raw, req.headers.get("x-hub-signature-256"), creds.appSecret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(raw) as WaPayload;
  // Stored before acknowledging so Meta's retry covers any failure.
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const names = new Map((change.value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]));
      for (const msg of change.value.messages ?? []) {
        // Text is stored as-is; other media types are recorded as a placeholder so the inquiry is still visible.
        const text = msg.text?.body ?? `[${msg.type}]`;
        await ingestMessage({
          platform: "WHATSAPP",
          phone: `+${msg.from}`,
          name: names.get(msg.from) ?? `+${msg.from}`,
          text,
          externalId: msg.id,
          threadId: `whatsapp:${msg.from}`,
          at: msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date(),
        });
      }
    }
  }
  return NextResponse.json({ ok: true });
}
