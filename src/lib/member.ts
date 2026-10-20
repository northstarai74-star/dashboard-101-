import { db } from "./db";
import { STAGES } from "./constants";

const OPEN = { notIn: ["WON", "LOST"] };

/** Everything one team member's dashboard shows. Only their own leads, deals and tasks. */
export async function memberWorkspace(userId: string) {
  const mine = { assignedUserId: userId };
  const [user, leads, deals, openTodos, todos, activity, unclaimed, latest] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, title: true, avatarColor: true, role: true, createdAt: true } }),
    db.lead.findMany({ where: mine, select: { stage: true, service: true } }),
    db.deal.findMany({ where: { lead: mine, status: "PAID" }, select: { amount: true, paidAt: true } }),
    db.todo.count({ where: { userId, done: false } }),
    db.todo.findMany({ where: { userId, done: false }, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], take: 6 }),
    db.activity.findMany({ where: { lead: mine }, orderBy: { createdAt: "desc" }, take: 8, include: { lead: { include: { contact: true } } } }),
    db.lead.count({ where: { assignedUserId: null, stage: OPEN } }),
    db.lead.findMany({ where: mine, orderBy: { createdAt: "desc" }, take: 7, include: { contact: true } }),
  ]);

  const won = leads.filter((l) => l.stage === "WON").length;
  const month = Date.now() - 30 * 86400_000;
  return {
    user,
    kpis: {
      open: leads.filter((l) => !["WON", "LOST"].includes(l.stage)).length,
      won,
      revenue: deals.reduce((s, d) => s + d.amount, 0),
      revenue30: deals.filter((d) => d.paidAt.getTime() >= month).reduce((s, d) => s + d.amount, 0),
      conversion: leads.length ? Math.round((won / leads.length) * 100) : 0,
      openTodos,
    },
    funnel: STAGES.filter((s) => s !== "LOST").map((stage) => ({ stage, count: leads.filter((l) => l.stage === stage).length })),
    todos,
    activity,
    latest,
    unclaimed,
  };
}
