import { db } from "./db";

const DAY = 86_400_000;

/** Launch target: recurring revenue from a fixed number of retained clients. Edit here to change the goal. */
export const GOALS = {
  targetMrr: 10_000,
  targetClients: 10,
  pricePerClient: 1_000,
};

/**
 * MRR is approximated from Deal rows: a client counts as recurring when they have a PAID deal
 * in the last 30 days. Revenue is summed over that same window.
 */
export async function getGoalSnapshot() {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * DAY);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [recent, history, pipeline] = await Promise.all([
    db.deal.findMany({ where: { status: "PAID", paidAt: { gte: monthAgo } }, select: { leadId: true, amount: true } }),
    db.deal.findMany({ where: { status: "PAID", paidAt: { gte: sixMonthsAgo } }, select: { leadId: true, amount: true, paidAt: true } }),
    db.lead.aggregate({ where: { stage: { notIn: ["WON", "LOST"] } }, _sum: { estimatedValue: true }, _count: true }),
  ]);

  const mrr = recent.reduce((s, d) => s + d.amount, 0);
  const activeClients = new Set(recent.map((d) => d.leadId)).size;
  const avgPerClient = activeClients ? mrr / activeClients : 0;

  // Last six calendar months, oldest first.
  const monthly = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - 4 + i, 1);
    const inMonth = history.filter((d) => d.paidAt >= start && d.paidAt < end);
    return {
      label: start.toLocaleDateString("en-US", { month: "short" }),
      revenue: inMonth.reduce((s, d) => s + d.amount, 0),
      clients: new Set(inMonth.map((d) => d.leadId)).size,
    };
  });

  const pct = (cur: number, target: number) => Math.min(100, Math.round((cur / target) * 100));
  const clientsNeeded = Math.max(0, GOALS.targetClients - activeClients);

  return {
    goals: GOALS,
    mrr,
    activeClients,
    avgPerClient,
    mrrProgress: pct(mrr, GOALS.targetMrr),
    clientProgress: pct(activeClients, GOALS.targetClients),
    mrrGap: Math.max(0, GOALS.targetMrr - mrr),
    clientsNeeded,
    // Open pipeline value if every open lead converted at the estimated value.
    pipelineValue: pipeline._sum.estimatedValue ?? 0,
    openLeads: pipeline._count,
    monthly,
  };
}
