"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Brain, Trash2 } from "lucide-react";
import type { AnalyticsSnapshot } from "@/lib/analytics";
import { Button, Card, CardHeader, Input, Label, Select, Textarea } from "@/components/ui";
import { cn, money } from "@/lib/utils";

export type ExpenseRow = { id: string; label: string; category: string; amount: number; date: string };
type CouncilAnswer = {
  mode: "live" | "offline";
  question: string;
  advisors: { name: string; advice: string }[];
  verdict: string;
  actions: string[];
};

const CATEGORIES = ["TOOLS", "ADS", "PAYROLL", "OPERATIONS", "OTHER"];
const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 };
const tick = { fontSize: 11, fill: "var(--muted)" };

async function call<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

function Delta({ value }: { value: number }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-semibold", value >= 0 ? "text-emerald-600" : "text-rose-600")}>
      {value >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(value)}%
    </span>
  );
}

function Sparkline({ days, values, color }: { days: string[]; values: number[]; color: string }) {
  const data = days.map((d, i) => ({ d, v: values[i] }));
  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={1.5} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AnalyticsView({ snapshot: s, expenses }: { snapshot: AnalyticsSnapshot; expenses: ExpenseRow[] }) {
  const f = s.finance;
  const money0 = (n: number) => money(n, true);

  return (
    <div className="space-y-6">
      {/* Finance */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Revenue", value: money0(f.revenue.total), delta: f.revenue.delta, tone: "text-emerald-600" },
          { label: "Expenses", value: money0(f.expenses.total), delta: f.expenses.delta, tone: "text-rose-600", invert: true },
          { label: "Profit", value: money0(f.profit.total), delta: f.profit.delta, tone: f.profit.total >= 0 ? "text-emerald-600" : "text-rose-600" },
          { label: "Margin", value: `${f.margin}%`, tone: "text-fg" },
        ].map((k) => (
          <Card key={k.label} className="p-5">
            <span className="text-sm font-medium text-muted">{k.label}</span>
            <p className={cn("mt-2 text-3xl font-semibold tabular-nums tracking-tight", k.tone)}>{k.value}</p>
            {k.delta !== undefined ? (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                <Delta value={k.invert ? -k.delta : k.delta} />
                <span className="text-muted">vs previous period</span>
              </div>
            ) : null}
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <CardHeader title="Revenue vs expenses" subtitle="Per day, for the selected period" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.days.map((d, i) => ({ d: d.slice(5), revenue: f.revenue.series[i], expenses: f.expenses.series[i] }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="d" tick={tick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={tick} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => money0(Number(v))} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v))} />
                <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader title="Expenses by category" subtitle="This period" />
          <ul className="mt-2 space-y-2 text-sm">
            {Object.entries(f.byCategory).map(([cat, amount]) => (
              <li key={cat} className="flex justify-between">
                <span className="text-muted">{cat.charAt(0) + cat.slice(1).toLowerCase()}</span>
                <span className="font-medium tabular-nums">{money(amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Channels */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Channels</h2>
        <p className="-mt-3 text-xs text-muted">
          <span className="font-medium text-fg">Live</span> = counted from data this app already records. <span className="font-medium text-fg">Manual</span> = log it below or push it from an automation to{" "}
          <code className="rounded bg-surface-2 px-1">/api/metrics/ingest</code>.
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {s.channels.map((ch) => (
            <Card key={ch.key} className="p-5">
              <CardHeader title={ch.label} />
              <div className="mt-3 grid grid-cols-2 gap-3">
                {ch.metrics.map((m, idx) => (
                  <div key={m.key} className="rounded-xl bg-surface-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted" title={m.label}>{m.label}</span>
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", m.tracking === "live" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600")}>
                        {m.tracking}
                      </span>
                    </div>
                    <p className="mt-1 text-xl font-semibold tabular-nums">{m.total.toLocaleString("en-US")}</p>
                    <div className="text-xs">
                      {m.total === 0 && m.prev === 0 ? <span className="text-muted">no data yet</span> : <Delta value={m.delta} />}
                    </div>
                    <Sparkline days={s.days} values={m.series} color={["#6366f1", "#06b6d4", "#f59e0b", "#10b981"][idx % 4]} />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <CouncilPanel />
        <div className="space-y-6">
          <LogMetricForm channels={s.channels.map((c) => ({ key: c.key, label: c.label, metrics: c.metrics.map((m) => ({ key: m.key, label: m.label })) }))} />
          <LogExpenseForm expenses={expenses} />
        </div>
      </div>
    </div>
  );
}

function CouncilPanel() {
  const [question, setQuestion] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [answer, setAnswer] = React.useState<CouncilAnswer | null>(null);
  const [error, setError] = React.useState("");

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setAnswer(await call<CouncilAnswer>("/api/council", "POST", { question }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the council");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <CardHeader title="The Council" subtitle='Five advisors review your numbers. You can also type "ask the council" in the chat.' />
      <form onSubmit={ask} className="mt-4 space-y-3">
        <Textarea rows={2} placeholder="e.g. Should I put more budget into WhatsApp or Instagram this month?" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            <Brain size={15} /> {busy ? "The council is deliberating…" : "Ask the council"}
          </Button>
        </div>
      </form>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      {answer ? (
        <div className="mt-5 space-y-4 text-sm">
          {answer.mode === "offline" ? <p className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">Offline advice: add a Claude key in Integrations for the full debate.</p> : null}
          <div className="grid gap-3">
            {answer.advisors.map((a) => (
              <div key={a.name} className="rounded-xl border p-3">
                <p className="font-semibold">{a.name}</p>
                <p className="mt-1 text-muted">{a.advice}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-accent/10 p-3">
            <p className="font-semibold">Verdict</p>
            <p className="mt-1">{answer.verdict}</p>
          </div>
          <div>
            <p className="font-semibold">Next 7 days</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              {answer.actions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function LogMetricForm({ channels }: { channels: { key: string; label: string; metrics: { key: string; label: string }[] }[] }) {
  const router = useRouter();
  const [channel, setChannel] = React.useState(channels[0]?.key ?? "");
  const metrics = channels.find((c) => c.key === channel)?.metrics ?? [];
  const [metric, setMetric] = React.useState(metrics[0]?.key ?? "");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await call("/api/metrics", "POST", { channel, metric, date, value: Number(value) });
      setValue("");
      setMsg("Saved. The day's value is replaced if it already existed.");
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <CardHeader title="Log a daily number" subtitle="For WhatsApp, YouTube, LinkedIn, email, website visits and other manual channels" />
      <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Channel</Label>
          <Select value={channel} onChange={(e) => { setChannel(e.target.value); setMetric(channels.find((c) => c.key === e.target.value)?.metrics[0]?.key ?? ""); }}>
            {channels.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Metric</Label>
          <Select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {metrics.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <Label>Value</Label>
          <Input type="number" min={0} step="any" value={value} onChange={(e) => setValue(e.target.value)} required />
        </div>
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <span className="text-xs text-muted">{msg}</span>
          <Button type="submit" disabled={busy || !metric}>Save</Button>
        </div>
      </form>
    </Card>
  );
}

function LogExpenseForm({ expenses }: { expenses: ExpenseRow[] }) {
  const router = useRouter();
  const [label, setLabel] = React.useState("");
  const [category, setCategory] = React.useState("TOOLS");
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await call("/api/expenses", "POST", { label, category, amount: Number(amount), date });
      setLabel("");
      setAmount("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await call(`/api/expenses/${id}`, "DELETE");
    router.refresh();
  }

  return (
    <Card className="p-5">
      <CardHeader title="Expenses" subtitle="Ads, tools, payroll and other costs. Revenue comes from paid deals on the Leads board." />
      <form onSubmit={add} className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>What was it?</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Meta ads, Vercel, freelancer…" required />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Amount (USD)</Label>
          <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <span className="text-xs text-rose-600">{error}</span>
          <Button type="submit" disabled={busy}>Add expense</Button>
        </div>
      </form>
      {expenses.length ? (
        <ul className="mt-4 divide-y text-sm">
          {expenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{e.label}</p>
                <p className="text-xs text-muted">{e.date.slice(0, 10)} · {e.category.toLowerCase()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">{money(e.amount)}</span>
                <button onClick={() => remove(e.id)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-rose-600" aria-label="Delete expense">
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
