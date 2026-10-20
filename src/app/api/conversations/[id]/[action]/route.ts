import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { conversationScope } from "@/lib/access";
import { suggestReply } from "@/lib/ai/classify";
import { createLead, dmSource } from "@/lib/ingest";
import { REPLY_PLATFORMS, sendDirectMessage } from "@/lib/outbox";
import { handOffToHuman } from "@/lib/agent";

type Ctx = { params: Promise<{ id: string; action: string }> };

export const POST = route<Ctx>(async (req, { params }, user) => {
  const { id, action } = await params;
  const convo = await db.conversation.findFirst({
    where: { id, ...conversationScope(user) },
    include: { contact: true, messages: { orderBy: { sentAt: "asc" } } },
  });
  if (!convo) return json({ error: "Conversation not found" }, 404);

  switch (action) {
    case "read":
      await db.conversation.update({ where: { id }, data: { unread: 0 } });
      return json({ ok: true });

    case "suggest":
      return json({ text: await suggestReply(convo.messages) });

    case "send": {
      const { text } = z.object({ text: z.string().min(1).max(1000) }).parse(await req.json());
      if (!REPLY_PLATFORMS.includes(convo.platform)) {
        return json({ error: `Replies to ${convo.platform.toLowerCase()} inquiries aren't sent from here yet` }, 400);
      }
      // sendDirectMessage checks the platform's own requirements (Instagram ID, phone number, Telegram chat, saved credentials).
      const msg = await sendDirectMessage(id, text);
      // A person replying by hand takes the conversation over from the AI agent.
      const aiLead = await db.lead.findFirst({ where: { contactId: convo.contactId, assignedAgent: "AI", stage: { notIn: ["WON", "LOST"] } } });
      if (aiLead) await handOffToHuman(aiLead, `${user.name} replied manually`, aiLead.assignedUserId ?? user.id);
      return json(msg, 201);
    }

    case "lead": {
      const existing = await db.lead.findFirst({ where: { contactId: convo.contactId, stage: { notIn: ["WON", "LOST"] } } });
      if (existing) return json({ error: "This contact already has an open lead" }, 409);
      const text = convo.messages.filter((m) => m.direction === "IN").map((m) => m.text).join("\n") || convo.contact.name;
      const lead = await createLead({ contactId: convo.contactId, source: dmSource(convo.platform), text });
      // A lead a team member opens from their inbox starts in their own list.
      if (user.role !== "ADMIN") return json(await db.lead.update({ where: { id: lead.id }, data: { assignedUserId: user.id, assignedAgent: "HUMAN" } }), 201);
      return json(lead, 201);
    }

    default:
      return json({ error: "Unknown action" }, 404);
  }
});
