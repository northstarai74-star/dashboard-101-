import { db } from "./db";
import { SERVICES, STAGES } from "./constants";

const DAY = 86400_000;

export async function dashboardStats(rangeDays: number) {
  const now = Date.now();
  const since = new Date(now - rangeDays * DAY);
  const prevSince = new Date(now - rangeDays * 2 * DAY);

  const [leads, prevLeads, deals, prevDeals, recent, activity] = await Promise.all([
    db.lead.findMany({ where: { createdAt: { gte: since } }, select: { service: true, stage: true, createdAt: true } }),
    db.lead.count({ where: { createdAt: { gte: prevSince, lt: since } } }),
    db.deal.findMany({ where: { paidAt: { gte: since }, status: "PAID" } }),
    db.deal.findMany({ where: { paidAt: { gte: prevSince, lt: since }, status: "PAID" } }),
    db.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 7,
      include: { contact: true, assignedUser: { select: { name: true, avatarColor: true } } },
    }),
    db.activity.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { lead: { include: { contact: true } } } }),
  ]);

  const revenue = deals.reduce((s, d) => s + d.amount, 0);
  const prevRevenue = prevDeals.reduce((s, d) => s + d.amount, 0);
  const customers = new Set(deals.map((d) => d.leadId)).size;
  const prevCustomers = new Set(prevDeals.map((d) => d.leadId)).size;
  const won = leads.filter((l) => l.stage === "WON").length;

  const byService = SERVICES.map((s) => ({
    service: s,
    leads: leads.filter((l) => l.service === s).length,
    revenue: deals.filter((d) => d.service === s).reduce((a, d) => a + d.amount, 0),
  }));

  // time series: daily up to 31 days, weekly beyond
  const bucket = rangeDays > 31 ? 7 : rangeDays > 14 ? 2 : 1;
  const buckets = Math.ceil(rangeDays / bucket);
  const series = Array.from({ length: buckets }, (_, i) => {
    const start = now - (buckets - i) * bucket * DAY;
    const end = start + bucket * DAY;
    const inB = leads.filter((l) => l.createdAt.getTime() >= start && l.createdAt.getTime() < end);
    return {
      label: new Date(end - DAY).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      total: inB.length,
      AI_VOICE: inB.filter((l) => l.service === "AI_VOICE").length,
      WEB_DEV: inB.filter((l) => l.service === "WEB_DEV").length,
    };
  });

  const funnel = STAGES.filter((s) => s !== "LOST").map((stage) => ({
    stage,
    count: leads.filter((l) => l.stage === stage).length,
  }));

  const delta = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100));

  return {
    kpis: {
      totalLeads: { value: leads.length, delta: delta(leads.length, prevLeads) },
      aiVoice: { value: byService.find((b) => b.service === "AI_VOICE")!.leads },
      webDev: { value: byService.find((b) => b.service === "WEB_DEV")!.leads },
      customers: { value: customers, delta: delta(customers, prevCustomers) },
      revenue: { value: revenue, delta: delta(revenue, prevRevenue) },
      conversion: { value: leads.length ? Math.round((won / leads.length) * 100) : 0 },
    },
    byService,
    series,
    funnel,
    recent,
    activity,
  };
}
