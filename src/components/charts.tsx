"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SERVICE_META, STAGE_META } from "@/lib/constants";

const tick = { fontSize: 11, fill: "var(--muted)" };
const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "0 8px 24px rgb(0 0 0 / 0.12)",
};

type Point = { label: string; total: number; AI_VOICE: number; WEB_DEV: number };

export function LeadsAreaChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <defs>
          {(["AI_VOICE", "WEB_DEV"] as const).map((s) => (
            <linearGradient key={s} id={`g-${s}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERVICE_META[s].color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={SERVICE_META[s].color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        {(["AI_VOICE", "WEB_DEV"] as const).map((s) => (
          <Area key={s} type="monotone" dataKey={s} name={SERVICE_META[s].short} stroke={SERVICE_META[s].color} strokeWidth={2} fill={`url(#g-${s})`} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ServiceDonut({ data }: { data: { service: string; leads: number }[] }) {
  const total = data.reduce((s, d) => s + d.leads, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="leads" nameKey="service" innerRadius={62} outerRadius={88} paddingAngle={3} cornerRadius={6} stroke="none">
            {data.map((d) => (
              <Cell key={d.service} fill={SERVICE_META[d.service].color} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [v, SERVICE_META[String(n)]?.short]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums">{total}</span>
        <span className="text-[11px] text-muted">categorised</span>
      </div>
    </div>
  );
}

export function RevenueBars({ data }: { data: { service: string; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data.map((d) => ({ ...d, name: SERVICE_META[d.service].short }))} margin={{ left: -10, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={tick} tickLine={false} axisLine={false} />
        <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v >= 1000 ? v / 1000 + "k" : v}`} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} formatter={(v) => [`$${Number(v).toLocaleString()}`, "Revenue"]} />
        <Bar dataKey="revenue" radius={[8, 8, 0, 0]} maxBarSize={56}>
          {data.map((d) => (
            <Cell key={d.service} fill={SERVICE_META[d.service].color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Funnel({ data }: { data: { stage: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.stage}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium">{STAGE_META[d.stage].label}</span>
            <span className="tabular-nums text-muted">{d.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className={`h-full rounded-full ${STAGE_META[d.stage].dot}`} style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
