"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { MarketingSnapshot } from "@/lib/marketing";
import { Button, Card, CardHeader, Input, Label } from "@/components/ui";
import { cn, money } from "@/lib/utils";

const SOURCE_COLORS: Record<string, string> = {
  META_DM: "#8b5cf6",
  META_COMMENT: "#3b82f6",
  META_LEAD_AD: "#10b981",
  MANUAL: "#94a3b8",
  other: "#f59e0b",
};
const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 };
const tick = { fontSize: 11, fill: "var(--muted)" };

const monthLabel = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
};

export function MarketingView({ snapshot }: { snapshot: MarketingSnapshot }) {
  const router = useRouter();
  const { current, previous, delta, months, sources } = snapshot;
  const [target, setTarget] = React.useState(current.target?.toString() ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function saveTarget(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const n = Number(target);
    if (!Number.isInteger(n) || n < 0) return setError("Enter a whole number of leads.");
    setSaving(true);
    try {
      const res = await fetch("/api/marketing/targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: current.month, target: n }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return setError(data.error ?? "Could not save the target");
      }
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const progress = current.attainment ?? 0;
  const chartData = months.map((m) => ({ ...m.bySource, other: m.other, label: monthLabel(m.month) }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">New leads this month</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{current.total}</p>
          <p className={cn("mt-1 flex items-center gap-1 text-xs", delta >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>
            {delta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {delta >= 0 ? "+" : ""}
            {delta}% vs last month ({previous.total})
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Monthly target</p>
          {current.target ? (
            <>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {current.total} <span className="text-base font-normal text-muted">/ {current.target}</span>
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
                <div className={cn("h-full rounded-full", progress >= 100 ? "bg-emerald-500" : "bg-accent")} style={{ width: `${Math.min(100, progress)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">{progress}% of target</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">No target set for this month yet.</p>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Cost per lead (ads)</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {current.costPerLead !== null ? money(current.costPerLead) : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {current.spend > 0 ? `${money(current.spend)} ad spend this month` : "Log ad spend under Analytics → Expenses (category ADS)"}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <CardHeader title="New leads by source" subtitle="Last 12 months" />
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: -16, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} />
                <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {sources.map((s) => (
                  <Bar key={s.key} dataKey={s.key} name={s.label} stackId="leads" fill={SOURCE_COLORS[s.key] ?? "#94a3b8"} />
                ))}
                <Bar dataKey="other" name="Other" stackId="leads" fill={SOURCE_COLORS.other} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader title={`Set target for ${monthLabel(current.month)}`} subtitle="New leads you want this month" />
          <form onSubmit={saveTarget} className="mt-4 space-y-3">
            <div>
              <Label>Target (leads)</Label>
              <Input type="number" min={0} step={1} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 120" />
            </div>
            {error && <p className="text-xs text-rose-600 dark:text-rose-300">{error}</p>}
            {saved && <p className="text-xs text-emerald-600 dark:text-emerald-300">Target saved.</p>}
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save target"}
            </Button>
          </form>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-5 pb-3">
          <CardHeader title="Month by month" subtitle="Leads, target and cost per lead" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y bg-surface-2/50 text-left text-xs text-muted">
              <tr>
                <th className="px-5 py-2.5 font-medium">Month</th>
                <th className="px-3 py-2.5 text-right font-medium">Leads</th>
                <th className="px-3 py-2.5 text-right font-medium">Target</th>
                <th className="px-3 py-2.5 text-right font-medium">Attained</th>
                <th className="px-3 py-2.5 text-right font-medium">Ad spend</th>
                <th className="px-5 py-2.5 text-right font-medium">Cost / lead</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...months].reverse().map((m) => (
                <tr key={m.month} className="hover:bg-surface-2/40">
                  <td className="px-5 py-2.5 font-medium">{monthLabel(m.month)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.total}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{m.target ?? "—"}</td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums", m.attainment !== null && m.attainment >= 100 && "text-emerald-600 dark:text-emerald-300")}>
                    {m.attainment !== null ? `${m.attainment}%` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.spend > 0 ? money(m.spend) : "—"}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{m.costPerLead !== null ? money(m.costPerLead) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
