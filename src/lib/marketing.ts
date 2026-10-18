import { z } from "zod";
import { db } from "./db";
import { SOURCE_META } from "./constants";

/** Monthly new-lead targets live in the Setting table as JSON: { "2026-10": 120, ... }. */
const TARGET_KEY = "marketing.leadTargets";
export const MONTHS_SHOWN = 12;

export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export async function getLeadTargets(): Promise<Record<string, number>> {
  const row = await db.setting.findUnique({ where: { key: TARGET_KEY } });
  if (!row) return {};
  try {
    const v = JSON.parse(row.value);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export const TargetInput = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must look like 2026-10"),
  target: z.number().int().min(0).max(100000),
});

export async function setLeadTarget(month: string, target: number) {
  const targets = await getLeadTargets();
  targets[month] = target;
  const value = JSON.stringify(targets);
  await db.setting.upsert({ where: { key: TARGET_KEY }, create: { key: TARGET_KEY, value }, update: { value } });
  return targets;
}

/** New leads per month by source, ad spend per month, and targets, for the last MONTHS_SHOWN months. */
export async function getMarketingSnapshot() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS_SHOWN - 1), 1));

  const [leads, ads, targets] = await Promise.all([
    db.lead.findMany({ where: { createdAt: { gte: start } }, select: { source: true, createdAt: true } }),
    db.expense.findMany({ where: { category: "ADS", date: { gte: start } }, select: { amount: true, date: true } }),
    getLeadTargets(),
  ]);

  const months = Array.from({ length: MONTHS_SHOWN }, (_, i) => monthKey(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1))));
  const sourceKeys = Object.keys(SOURCE_META);

  const rows = months.map((month) => {
    const inMonth = leads.filter((l) => monthKey(l.createdAt) === month);
    const bySource = Object.fromEntries(sourceKeys.map((s) => [s, inMonth.filter((l) => l.source === s).length])) as Record<string, number>;
    const known = Object.values(bySource).reduce((a, b) => a + b, 0);
    const spend = ads.filter((e) => monthKey(e.date) === month).reduce((a, e) => a + e.amount, 0);
    const target = targets[month] ?? null;
    return {
      month,
      total: inMonth.length,
      other: inMonth.length - known,
      bySource,
      spend,
      target,
      attainment: target ? Math.round((inMonth.length / target) * 100) : null,
      costPerLead: inMonth.length > 0 && spend > 0 ? spend / inMonth.length : null,
    };
  });

  const current = rows[rows.length - 1];
  const previous = rows[rows.length - 2];
  return {
    months: rows,
    sources: sourceKeys.map((key) => ({ key, label: SOURCE_META[key] })),
    current,
    previous,
    delta: previous.total === 0 ? (current.total > 0 ? 100 : 0) : Math.round(((current.total - previous.total) / previous.total) * 100),
  };
}

export type MarketingSnapshot = Awaited<ReturnType<typeof getMarketingSnapshot>>;
