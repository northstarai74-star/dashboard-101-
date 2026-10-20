import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { canAccessLead } from "@/lib/access";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ amount: z.number().positive("Enter the amount paid") });

/** Marks the lead as won and records the revenue. */
export const POST = route<Ctx>(async (req, { params }, user) => {
  const { id } = await params;
  const { amount } = Body.parse(await req.json());
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead || !canAccessLead(user, lead)) return json({ error: "Not found" }, 404);
  if (lead.stage === "WON") return json({ error: "This lead is already converted" }, 409);
  if (lead.service === "UNASSIGNED") return json({ error: "Assign a service before converting" }, 400);

  const [deal] = await db.$transaction([
    db.deal.create({ data: { leadId: id, service: lead.service, amount, status: "PAID" } }),
    db.lead.update({ where: { id }, data: { stage: "WON", estimatedValue: amount } }),
    db.activity.create({ data: { leadId: id, userId: user.id, type: "CONVERTED", text: `Converted — $${amount.toLocaleString()} paid` } }),
  ]);
  return json(deal, 201);
});
