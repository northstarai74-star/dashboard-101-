import { db } from "./db";
import { classifyText } from "./ai/classify";
import { getSettings } from "./settings";

/** True for Prisma's unique-constraint error — a concurrent delivery of the same Meta event already won. */
const isDuplicate = (err: unknown) => (err as { code?: string })?.code === "P2002";

type ContactInput = { igUserId?: string; name?: string; handle?: string; email?: string; phone?: string };

/** Channels that can hold a conversation. Instagram is the default for the Meta webhook. */
export const PLATFORMS = ["INSTAGRAM", "WHATSAPP", "TELEGRAM", "LINKEDIN"] as const;
export type Platform = (typeof PLATFORMS)[number];

/** Lead source recorded for a DM on each platform (INSTAGRAM keeps the original META_DM value). */
export const dmSource = (platform: string) => (platform === "INSTAGRAM" ? "META_DM" : `${platform}_DM`);

export async function upsertContact(input: ContactInput, source: string) {
  if (input.igUserId) {
    const existing = await db.contact.findUnique({ where: { igUserId: input.igUserId } });
    if (existing) return existing;
  }
  if (input.email) {
    const byEmail = await db.contact.findFirst({ where: { email: input.email } });
    if (byEmail) return byEmail;
  }
  if (input.phone) {
    const byPhone = await db.contact.findFirst({ where: { phone: input.phone } });
    if (byPhone) return byPhone;
  }
  try {
    return await db.contact.create({
      data: {
        name: input.name || input.handle || "Instagram user",
        instagramHandle: input.handle,
        igUserId: input.igUserId,
        email: input.email,
        phone: input.phone,
        source,
      },
    });
  } catch (err) {
    // Meta can deliver bursts concurrently; if another request created this contact first, reuse it.
    if (input.igUserId && isDuplicate(err)) {
      const raced = await db.contact.findUnique({ where: { igUserId: input.igUserId } });
      if (raced) return raced;
    }
    throw err;
  }
}

/** The team member with the fewest open leads (null when there is no team yet). */
async function leastLoadedUserId() {
  const users = await db.user.findMany({ include: { _count: { select: { leads: { where: { stage: { notIn: ["WON", "LOST"] } } } } } } });
  users.sort((a, b) => a._count.leads - b._count.leads);
  return users[0]?.id ?? null;
}

/** Picks who should own a lead: the service's assignment rule, else the least-loaded team member. */
export async function pickAssignee(service: string) {
  const rule = await db.assignmentRule.findUnique({ where: { service } });
  if (rule) return { agent: rule.agent, userId: rule.userId };
  return { agent: "HUMAN", userId: await leastLoadedUserId() };
}

/** The person who takes over when the AI agent hands a lead off: the rule's owner, else the least-loaded member. */
export async function pickHuman(service: string) {
  const rule = await db.assignmentRule.findUnique({ where: { service } });
  return rule?.userId ?? (await leastLoadedUserId());
}

/** Creates a lead, classifies it with Claude (or heuristics) and auto-assigns it. */
export async function createLead(opts: { contactId: string; source: string; text: string; title?: string }) {
  const [cls, settings] = await Promise.all([classifyText(opts.text), getSettings()]);
  const assign =
    settings.autoAssign && cls.service !== "UNASSIGNED"
      ? await pickAssignee(cls.service)
      : { agent: "HUMAN", userId: null as string | null };

  const lead = await db.lead.create({
    data: {
      contactId: opts.contactId,
      source: opts.source,
      title: opts.title ?? (opts.text.length > 60 ? opts.text.slice(0, 57) + "…" : opts.text),
      service: cls.service,
      score: cls.score,
      aiSummary: cls.summary,
      assignedAgent: assign.agent,
      assignedUserId: assign.userId,
      estimatedValue: { AI_VOICE: 1500, WEB_DEV: 3000, UNASSIGNED: 0 }[cls.service],
    },
  });
  await db.activity.createMany({
    data: [
      { leadId: lead.id, type: "CREATED", text: `Lead captured from ${opts.source.replace("META_", "").replace("_", " ").toLowerCase()}` },
      {
        leadId: lead.id,
        type: "AI",
        text: `Claude classified as ${cls.service.replace("_", " ")} (score ${cls.score}) and assigned to ${assign.agent === "AI" ? "AI agent" : "team"}`,
      },
    ],
  });
  return lead;
}

export async function ingestMessage(
  m: ContactInput & { text: string; externalId?: string; direction?: "IN" | "OUT"; threadId?: string; at?: Date; platform?: Platform },
) {
  if (m.externalId && (await db.message.findUnique({ where: { externalId: m.externalId } }))) return null;
  const platform = m.platform ?? "INSTAGRAM";
  const contact = await upsertContact(m, dmSource(platform));
  const direction = m.direction ?? "IN";

  const convo =
    (m.threadId && (await db.conversation.findUnique({ where: { externalId: m.threadId } }))) ||
    (await db.conversation.findFirst({ where: { contactId: contact.id, platform } })) ||
    (await db.conversation.create({ data: { contactId: contact.id, externalId: m.threadId, platform } }));

  try {
    await db.message.create({
      data: { conversationId: convo.id, externalId: m.externalId, direction, text: m.text, sentAt: m.at ?? new Date() },
    });
  } catch (err) {
    if (isDuplicate(err)) return null;
    throw err;
  }
  await db.conversation.update({
    where: { id: convo.id },
    data: { lastMessageAt: m.at ?? new Date(), unread: direction === "IN" ? { increment: 1 } : undefined },
  });

  if (direction === "IN") {
    const open = await db.lead.findFirst({ where: { contactId: contact.id, stage: { notIn: ["WON", "LOST"] } } });
    if (!open) await createLead({ contactId: contact.id, source: dmSource(platform), text: m.text });
  }
  return { contactId: contact.id, conversationId: convo.id };
}

export async function ingestComment(c: ContactInput & { text: string; externalId?: string; postRef?: string }) {
  if (c.externalId && (await db.comment.findUnique({ where: { externalId: c.externalId } }))) return null;
  const contact = await upsertContact(c, "META_COMMENT");
  try {
    return await db.comment.create({
      data: {
        externalId: c.externalId,
        contactId: contact.id,
        author: c.handle || c.name || "instagram_user",
        text: c.text,
        postRef: c.postRef,
      },
    });
  } catch (err) {
    if (isDuplicate(err)) return null;
    throw err;
  }
}

export async function ingestLeadAd(e: {
  externalId?: string;
  formName?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  raw?: unknown;
}) {
  if (e.externalId && (await db.enquiry.findUnique({ where: { externalId: e.externalId } }))) return null;
  const contact = await upsertContact({ name: e.name, email: e.email, phone: e.phone }, "META_LEAD_AD");
  const text = [e.formName, e.message].filter(Boolean).join(" — ") || `Lead ad form from ${e.name ?? "unknown"}`;
  const lead = await createLead({ contactId: contact.id, source: "META_LEAD_AD", text });
  return db.enquiry.create({
    data: {
      externalId: e.externalId,
      leadId: lead.id,
      formName: e.formName,
      name: e.name,
      email: e.email,
      phone: e.phone,
      message: e.message,
      raw: e.raw ? JSON.stringify(e.raw) : null,
      handled: true,
    },
  });
}
