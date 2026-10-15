import { z } from "zod";
import { db } from "./db";

const DAY = 86_400_000;

/** Counts this app already records itself. Anything else is filled by hand or pushed to /api/metrics/ingest. */
type NativeSource = "ig_dms_in" | "ig_dms_out" | "ig_comments" | "ig_comment_leads" | "enquiries" | "creatives";

type MetricDef = { label: string; native?: NativeSource };

/** Dashboard channels. Add a metric here and it appears on the Analytics page and in the AI context. */
export const CHANNELS: Record<string, { label: string; metrics: Record<string, MetricDef> }> = {
  INSTAGRAM: {
    label: "Instagram",
    metrics: {
      dms_received: { label: "DMs received", native: "ig_dms_in" },
      dms_sent: { label: "DMs sent", native: "ig_dms_out" },
      comments: { label: "Comments", native: "ig_comments" },
      comment_inquiries: { label: "Inquiries from comments", native: "ig_comment_leads" },
      views: { label: "Views" },
    },
  },
  WHATSAPP: {
    label: "WhatsApp (AI agent number)",
    metrics: {
      messages_received: { label: "Messages received" },
      messages_sent: { label: "Messages sent" },
    },
  },
  YOUTUBE: {
    label: "YouTube",
    metrics: {
      views: { label: "Views" },
      comments: { label: "Comments" },
    },
  },
  LINKEDIN: {
    label: "LinkedIn",
    metrics: {
      views: { label: "Post views" },
      posts: { label: "Posts published" },
    },
  },
  CREATION: {
    label: "Creation tools",
    metrics: {
      creatives: { label: "Images generated", native: "creatives" },
      creations: { label: "Other creations (videos, copy, decks)" },
    },
  },
  EMAIL: {
    label: "Email",
    metrics: {
      emails_sent: { label: "Emails sent" },
    },
  },
  WEBSITE: {
    label: "Website & forms",
    metrics: {
      visits: { label: "Website visits" },
      form_fills: { label: "Form fills (Meta lead forms + website)", native: "enquiries" },
    },
  },
};

export const EXPENSE_CATEGORIES = ["TOOLS", "ADS", "PAYROLL", "OPERATIONS", "OTHER"] as const;

export function isKnownMetric(channel: string, metric: string) {
  return Boolean(CHANNELS[channel]?.metrics[metric]);
}

type Point = { t: Date; v: number };

const utcMidnight = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function pctDelta(cur: number, prev: number) {
  return prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);
}

/**
 * Totals and per-day series for the current window, plus the total for the window before it.
 * `curStart` is the first day of the current window; `prevStart` is `days` days before it.
 */
export function windowSummary(points: Point[], curStart: Date, prevStart: Date, days: number) {
  const series = Array.from({ length: days }, () => 0);
  const curMs = curStart.getTime();
  const prevMs = prevStart.getTime();
  let total = 0;
  let prev = 0;
  for (const p of points) {
    const ms = p.t.getTime();
    if (ms >= curMs) {
      const i = Math.floor((ms - curMs) / DAY);
      if (i < days) {
        series[i] += p.v;
        total += p.v;
      }
    } else if (ms >= prevMs) {
      prev += p.v;
    }
  }
  return { total, prev, delta: pctDelta(total, prev), series };
}

export type AnalyticsSnapshot = Awaited<ReturnType<typeof getAnalyticsSnapshot>>;

export async function getAnalyticsSnapshot(rangeDays: number) {
  const today = utcMidnight(new Date());
  const curStart = new Date(today.getTime() - (rangeDays - 1) * DAY);
  const prevStart = new Date(curStart.getTime() - rangeDays * DAY);
  const since = prevStart;

  const [entries, messages, comments, commentLeads, enquiries, creatives, deals, expenses] = await Promise.all([
    db.metricEntry.findMany({ where: { date: { gte: since } }, select: { channel: true, metric: true, date: true, value: true } }),
    db.message.findMany({
      where: { sentAt: { gte: since }, conversation: { platform: "INSTAGRAM" } },
      select: { direction: true, sentAt: true },
    }),
    db.comment.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.lead.findMany({ where: { source: "META_COMMENT", createdAt: { gte: since } }, select: { createdAt: true } }),
    db.enquiry.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.creative.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.deal.findMany({ where: { status: "PAID", paidAt: { gte: since } }, select: { amount: true, paidAt: true } }),
    db.expense.findMany({ where: { date: { gte: since } }, select: { amount: true, date: true, category: true } }),
  ]);

  const natives: Record<NativeSource, Point[]> = {
    ig_dms_in: messages.filter((m) => m.direction === "IN").map((m) => ({ t: m.sentAt, v: 1 })),
    ig_dms_out: messages.filter((m) => m.direction === "OUT").map((m) => ({ t: m.sentAt, v: 1 })),
    ig_comments: comments.map((c) => ({ t: c.createdAt, v: 1 })),
    ig_comment_leads: commentLeads.map((l) => ({ t: l.createdAt, v: 1 })),
    enquiries: enquiries.map((e) => ({ t: e.createdAt, v: 1 })),
    creatives: creatives.map((c) => ({ t: c.createdAt, v: 1 })),
  };

  const manual = new Map<string, Point[]>();
  for (const e of entries) {
    const key = `${e.channel}.${e.metric}`;
    manual.set(key, [...(manual.get(key) ?? []), { t: e.date, v: e.value }]);
  }

  const channels = Object.entries(CHANNELS).map(([key, channel]) => ({
    key,
    label: channel.label,
    metrics: Object.entries(channel.metrics).map(([metricKey, def]) => {
      const points = [...(manual.get(`${key}.${metricKey}`) ?? []), ...(def.native ? natives[def.native] : [])];
      return {
        key: metricKey,
        label: def.label,
        tracking: def.native ? ("live" as const) : ("manual" as const),
        ...windowSummary(points, curStart, prevStart, rangeDays),
      };
    }),
  }));

  const revenue = windowSummary(
    deals.map((d) => ({ t: d.paidAt, v: d.amount })),
    curStart,
    prevStart,
    rangeDays,
  );
  const costs = windowSummary(
    expenses.map((e) => ({ t: e.date, v: e.amount })),
    curStart,
    prevStart,
    rangeDays,
  );
  const profitTotal = revenue.total - costs.total;
  const profitPrev = revenue.prev - costs.prev;
  const byCategory = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0])) as Record<string, number>;
  for (const e of expenses) {
    if (e.date.getTime() >= curStart.getTime()) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  }

  return {
    rangeDays,
    days: Array.from({ length: rangeDays }, (_, i) => isoDay(new Date(curStart.getTime() + i * DAY))),
    channels,
    finance: {
      revenue,
      expenses: costs,
      profit: {
        total: profitTotal,
        prev: profitPrev,
        delta: pctDelta(profitTotal, profitPrev),
        series: revenue.series.map((r, i) => r - costs.series[i]),
      },
      margin: revenue.total > 0 ? Math.round((profitTotal / revenue.total) * 100) : 0,
      byCategory,
    },
  };
}

/** Plain-text digest of the snapshot, used as context for the chatbot and the council. */
export function summarizeForAi(s: AnalyticsSnapshot) {
  const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const lines: string[] = [`Period: last ${s.rangeDays} days, compared with the ${s.rangeDays} days before.`];
  for (const ch of s.channels) {
    for (const m of ch.metrics) {
      const state = m.total === 0 && m.prev === 0 ? "no data yet" : `${m.total} (previous ${m.prev}, change ${m.delta >= 0 ? "+" : ""}${m.delta}%)`;
      lines.push(`${ch.label} - ${m.label}: ${state}`);
    }
  }
  const f = s.finance;
  lines.push(`Revenue: ${money(f.revenue.total)} (previous ${money(f.revenue.prev)})`);
  lines.push(`Expenses: ${money(f.expenses.total)} (previous ${money(f.expenses.prev)})`);
  lines.push(`Profit: ${money(f.profit.total)}, margin ${f.margin}%`);
  const cats = Object.entries(f.byCategory)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k} ${money(v)}`)
    .join(", ");
  if (cats) lines.push(`Expenses by category: ${cats}`);
  return lines.join("\n");
}

export const MetricInput = z.object({
  channel: z.string(),
  metric: z.string(),
  value: z.number().finite().min(0).max(1e12),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  source: z.string().min(1).max(40).optional(),
});
export type MetricInput = z.infer<typeof MetricInput>;

/** Sets the value for one channel/metric/day/source. Re-sending the same day replaces the value. */
export async function upsertMetric(input: MetricInput) {
  if (!isKnownMetric(input.channel, input.metric)) throw new Error(`Unknown metric ${input.channel}.${input.metric}`);
  const date = new Date(`${input.date ?? isoDay(new Date())}T00:00:00.000Z`);
  const source = input.source ?? "manual";
  return db.metricEntry.upsert({
    where: { channel_metric_date_source: { channel: input.channel, metric: input.metric, date, source } },
    create: { channel: input.channel, metric: input.metric, date, source, value: input.value },
    update: { value: input.value },
  });
}
