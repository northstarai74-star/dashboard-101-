import { NextResponse } from "next/server";
import { channelCredentials } from "@/lib/connections";
import { safeEqual } from "@/lib/meta";
import { ingestMessage } from "@/lib/ingest";

// Public endpoint (excluded from the login proxy). Telegram proves it is the sender with the secret token
// registered through setWebhook, sent back in X-Telegram-Bot-Api-Secret-Token.

type TgUpdate = {
  message?: {
    message_id: number;
    date?: number;
    text?: string;
    caption?: string;
    chat: { id: number; type: string };
    from?: { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string };
  };
};

export async function POST(req: Request) {
  const creds = await channelCredentials("TELEGRAM");
  const given = req.headers.get("x-telegram-bot-api-secret-token");
  if (!creds.webhookSecret || !safeEqual(given, creds.webhookSecret)) return new NextResponse("Forbidden", { status: 403 });

  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  const m = update?.message;
  // Only private chats with people: groups and bots are ignored.
  if (!m || m.chat.type !== "private" || m.from?.is_bot) return NextResponse.json({ ok: true });

  const name = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(" ") || m.from?.username || `Telegram ${m.chat.id}`;
  await ingestMessage({
    platform: "TELEGRAM",
    // igUserId is the contact's unique external id column: reused here so every message from one chat lands on one contact.
    igUserId: `telegram:${m.chat.id}`,
    name,
    handle: m.from?.username,
    text: m.text ?? m.caption ?? "[attachment]",
    externalId: `${m.chat.id}:${m.message_id}`,
    threadId: `telegram:${m.chat.id}`,
    at: m.date ? new Date(m.date * 1000) : new Date(),
  });
  return NextResponse.json({ ok: true });
}
