import { db } from "./db";
import { getSettings } from "./settings";
import { sendInstagramMessage } from "./meta";

const isDuplicate = (err: unknown) => (err as { code?: string })?.code === "P2002";

/**
 * Stores an outgoing DM. Meta echoes every message the page sends back to the webhook with the same
 * `mid`; if that echo was stored first, the existing row is reused instead of creating a duplicate.
 */
export async function recordOutgoing(conversationId: string, text: string, opts: { externalId?: string; byAi?: boolean } = {}) {
  let msg;
  try {
    msg = await db.message.create({
      data: { conversationId, direction: "OUT", text, externalId: opts.externalId, byAi: opts.byAi ?? false },
    });
  } catch (err) {
    if (!opts.externalId || !isDuplicate(err)) throw err;
    msg = await db.message.update({ where: { externalId: opts.externalId }, data: { byAi: opts.byAi ?? false } });
  }
  await db.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: msg.sentAt, unread: 0 } });
  return msg;
}

/** Sends a DM through Meta (skipped in demo mode, where it is only recorded) and stores it. */
export async function sendDirectMessage(conversationId: string, text: string, opts: { byAi?: boolean } = {}) {
  const convo = await db.conversation.findUnique({ where: { id: conversationId }, include: { contact: true } });
  if (!convo) throw new Error("Conversation not found");
  if (convo.platform !== "INSTAGRAM") throw new Error(`Replies to ${convo.platform.toLowerCase()} inquiries aren't sent from here yet`);
  const settings = await getSettings();
  let externalId: string | undefined;
  if (!settings.demoMode) {
    if (!convo.contact.igUserId) throw new Error("This contact has no Instagram ID to message");
    externalId = (await sendInstagramMessage(convo.contact.igUserId, text)).message_id;
  }
  return recordOutgoing(conversationId, text, { externalId, byAi: opts.byAi });
}
