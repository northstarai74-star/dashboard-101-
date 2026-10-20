import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { canAccessLead } from "@/lib/access";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }, user) => {
  const { id } = await params;
  const { text } = z.object({ text: z.string().min(1).max(2000) }).parse(await req.json());
  const lead = await db.lead.findUnique({ where: { id }, select: { assignedUserId: true } });
  if (!lead || !canAccessLead(user, lead)) return json({ error: "Not found" }, 404);
  const note = await db.activity.create({ data: { leadId: id, userId: user.id, type: "NOTE", text } });
  return json(note, 201);
});
