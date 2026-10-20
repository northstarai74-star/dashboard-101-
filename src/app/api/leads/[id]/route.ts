import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { canAccessLead, isAdmin } from "@/lib/access";
import { SERVICE_META, STAGE_META } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }, me) => {
  const { id } = await params;
  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      contact: true,
      assignedUser: { select: { id: true, name: true, avatarColor: true } },
      activities: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
      deals: true,
    },
  });
  if (!lead || !canAccessLead(me, lead)) return json({ error: "Not found" }, 404);
  return json(lead);
});

const Patch = z.object({
  stage: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"]).optional(),
  service: z.enum(["AI_VOICE", "WEB_DEV", "UNASSIGNED"]).optional(),
  assignedAgent: z.enum(["AI", "HUMAN"]).optional(),
  assignedUserId: z.string().nullable().optional(),
  estimatedValue: z.number().min(0).optional(),
});

export const PATCH = route<Ctx>(async (req, { params }, user) => {
  const { id } = await params;
  const patch = Patch.parse(await req.json());
  const before = await db.lead.findUnique({ where: { id } });
  if (!before || !canAccessLead(user, before)) return json({ error: "Not found" }, 404);
  // A team member can take a lead for themselves or hand it back, but not push it onto someone else.
  if (!isAdmin(user) && patch.assignedUserId && patch.assignedUserId !== user.id) {
    return json({ error: "You can only assign leads to yourself" }, 403);
  }
  if (patch.stage === "WON" && before.stage !== "WON") {
    return json({ error: "Use convert to mark a lead as won so the revenue is recorded" }, 400);
  }

  if (patch.assignedUserId && !(await db.user.findUnique({ where: { id: patch.assignedUserId }, select: { id: true } }))) {
    return json({ error: "Team member not found" }, 400);
  }

  const lead = await db.lead.update({ where: { id }, data: patch });
  // keep revenue attribution in step with the lead's service
  if (patch.service && patch.service !== "UNASSIGNED") await db.deal.updateMany({ where: { leadId: id }, data: { service: patch.service } });

  const notes: { type: string; text: string }[] = [];
  if (patch.stage && patch.stage !== before.stage) notes.push({ type: "STAGE", text: `Stage moved to ${STAGE_META[patch.stage].label}` });
  if (patch.service && patch.service !== before.service) notes.push({ type: "ASSIGNED", text: `Assigned to ${SERVICE_META[patch.service].label}` });
  if (patch.assignedAgent && patch.assignedAgent !== before.assignedAgent)
    notes.push({ type: "ASSIGNED", text: patch.assignedAgent === "AI" ? "Handed to the AI agent" : "Handed to a human" });
  if (patch.assignedUserId !== undefined && patch.assignedUserId !== before.assignedUserId) {
    const u = patch.assignedUserId ? await db.user.findUnique({ where: { id: patch.assignedUserId } }) : null;
    notes.push({ type: "ASSIGNED", text: u ? `Assigned to ${u.name}` : "Unassigned from team member" });
  }
  for (const n of notes) {
    await db.activity.create({ data: { leadId: id, userId: user.id, ...n } });
  }
  return json(lead);
});

export const DELETE = route<Ctx>(
  async (_req, { params }) => {
    const { id } = await params;
    await db.lead.delete({ where: { id } });
    return json({ ok: true });
  },
  { admin: true },
);
