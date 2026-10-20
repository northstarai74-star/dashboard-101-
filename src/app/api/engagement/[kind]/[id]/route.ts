import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { createLead, upsertContact } from "@/lib/ingest";
import { getSettings } from "@/lib/settings";
import { replyToComment } from "@/lib/meta";

type Ctx = { params: Promise<{ kind: string; id: string }> };

const Body = z.object({ action: z.enum(["convert", "handle", "reply"]), text: z.string().optional() });

export const POST = route<Ctx>(async (req, { params }) => {
  const { kind, id } = await params;
  const { action, text } = Body.parse(await req.json());

  if (kind === "comments") {
    const c = await db.comment.findUnique({ where: { id }, include: { contact: true } });
    if (!c) return json({ error: "Not found" }, 404);

    if (action === "reply") {
      if (!text?.trim()) return json({ error: "Write a reply first" }, 400);
      const settings = await getSettings();
      if (!settings.demoMode) {
        if (!c.externalId) return json({ error: "This comment has no Instagram ID" }, 400);
        await replyToComment(c.externalId, text);
      }
      await db.comment.update({ where: { id }, data: { handled: true } });
      return json({ ok: true });
    }
    if (action === "convert") {
      const contact = c.contact ?? (await upsertContact({ handle: c.author }, "META_COMMENT"));
      const lead = await createLead({ contactId: contact.id, source: "META_COMMENT", text: c.text });
      await db.comment.update({ where: { id }, data: { handled: true, leadId: lead.id, contactId: contact.id } });
      return json(lead, 201);
    }
    await db.comment.update({ where: { id }, data: { handled: true } });
    return json({ ok: true });
  }

  if (kind === "enquiries") {
    const e = await db.enquiry.findUnique({ where: { id } });
    if (!e) return json({ error: "Not found" }, 404);
    if (action === "convert") {
      const contact = await upsertContact({ name: e.name ?? undefined, email: e.email ?? undefined, phone: e.phone ?? undefined }, "META_LEAD_AD");
      const lead = await createLead({ contactId: contact.id, source: "META_LEAD_AD", text: [e.formName, e.message].filter(Boolean).join(" — ") || e.name || "Lead ad enquiry" });
      await db.enquiry.update({ where: { id }, data: { handled: true, leadId: lead.id } });
      return json(lead, 201);
    }
    await db.enquiry.update({ where: { id }, data: { handled: true } });
    return json({ ok: true });
  }

  return json({ error: "Unknown kind" }, 404);
}, { admin: true });
