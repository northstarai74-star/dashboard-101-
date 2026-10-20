import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { createLead } from "@/lib/ingest";

const Body = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  instagramHandle: z.string().optional(),
  company: z.string().optional(),
  message: z.string().min(1, "Describe what the lead wants"),
});

export const POST = route(async (req, _ctx, me) => {
  const b = Body.parse(await req.json());
  const contact = await db.contact.create({
    data: {
      name: b.name,
      email: b.email || null,
      phone: b.phone || null,
      instagramHandle: b.instagramHandle?.replace(/^@/, "") || null,
      company: b.company || null,
      source: "MANUAL",
    },
  });
  let lead = await createLead({ contactId: contact.id, source: "MANUAL", text: b.message });
  // Auto-assignment may have routed it to someone else; a lead a team member adds starts in their own list.
  if (me.role !== "ADMIN") {
    lead = await db.lead.update({ where: { id: lead.id }, data: { assignedUserId: me.id, assignedAgent: "HUMAN" } });
  }
  return json(lead, 201);
});
