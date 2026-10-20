import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { conversationScope } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { suggestReply } from "@/lib/ai/classify";
import { createLead } from "@/lib/ingest";
import { sendDirectMessage } from "@/lib/outbox";
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
      if (convo.platform !== "INSTAGRAM") {
        return json({ error: `Replies to ${convo.platform.toLowerCase()} inquiries aren't sent from here yet` }, 400);
      }
      if (!convo.contact.igUserId && !(await getSettings()).demoMode) {
        return json({ error: "This contact has no Instagram ID to message" }, 400);
      }
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
      const lead = await createLead({ contactId: convo.contactId, source: "META_DM", text });
      // A lead a team member opens from their inbox starts in their own list.
      if (user.role !== "ADMIN") return json(await db.lead.update({ where: { id: lead.id }, data: { assignedUserId: user.id, assignedAgent: "HUMAN" } }), 201);
      return json(lead, 201);
    }

    default:
      return json({ error: "Unknown action" }, 404);
  }
});
