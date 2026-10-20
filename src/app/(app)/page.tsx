import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, BadgeCheck, DollarSign, Inbox, Link2, Mic, TrendingUp, UserPlus, Users, Globe } from "lucide-react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { memberWorkspace } from "@/lib/member";
import { MemberWorkspace } from "@/components/member-workspace";
import { dashboardStats } from "@/lib/stats";
import { listChannels } from "@/lib/connections";
import { PageHeader } from "@/components/shell";
import { Avatar, Card, CardHeader, Empty, ScoreBadge, ServiceBadge } from "@/components/ui";
import { Funnel, LeadsAreaChart } from "@/components/charts";
import { SERVICE_META } from "@/lib/constants";
import { cn, money, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RANGES = [
  { v: 7, label: "7 days" },
  { v: 30, label: "30 days" },
  { v: 90, label: "90 days" },
];

const SERVICE_ICON = { AI_VOICE: Mic, WEB_DEV: Globe } as const;

/** Headline figure with its change against the previous period. */
function Headline({ label, value, delta, icon: Icon, tone }: { label: string; value: string; delta?: number; icon: typeof Users; tone: string }) {
  return (
    <div className="rounded-2xl border bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tone)}>
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {delta !== undefined && (
        <p className={cn("mt-1.5 inline-flex items-center gap-0.5 text-xs font-semibold", delta >= 0 ? "text-emerald-600" : "text-rose-600")}>
          {delta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(delta)}% <span className="font-normal text-muted">vs previous period</span>
        </p>
      )}
    </div>
  );
}

/** Admins get the business-wide dashboard; each team member gets their own workspace. */
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role === "ADMIN") return <AdminDashboard searchParams={searchParams} />;

  const w = await memberWorkspace(me.id);
  return (
    <>
      <PageHeader title={`Welcome, ${me.name.split(" ")[0]}`} subtitle="Your leads, results and to-dos" />
      <MemberWorkspace w={w} />
    </>
  );
}

async function AdminDashboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range } = await searchParams;
  const rangeDays = [7, 30, 90].includes(Number(range)) ? Number(range) : 30;

  const [s, unread, unassigned, channels, users] = await Promise.all([
    dashboardStats(rangeDays),
    db.conversation.aggregate({ _sum: { unread: true } }),
    db.lead.count({ where: { assignedUserId: null, stage: { notIn: ["WON", "LOST"] } } }),
    listChannels(),
    db.user.findMany({
      orderBy: { createdAt: "asc" },
      include: { leads: { select: { stage: true, deals: { select: { amount: true } } } } },
    }),
  ]);
  const k = s.kpis;
  const team = users.map((u) => {
    const open = u.leads.filter((l) => !["WON", "LOST"].includes(l.stage));
    return {
      id: u.id,
      name: u.name,
      title: u.title,
      avatarColor: u.avatarColor,
      openLeads: open.length,
      won: u.leads.filter((l) => l.stage === "WON").length,
      revenue: u.leads.flatMap((l) => l.deals).reduce((sum, d) => sum + d.amount, 0),
    };
  });
  const maxOpen = Math.max(1, ...team.map((m) => m.openLeads));
  const totalLeads = s.byService.reduce((n, b) => n + b.leads, 0);
  const unreadCount = unread._sum.unread ?? 0;
  const connected = channels.filter((c) => c.status === "CONNECTED").length;
  const failing = channels.filter((c) => c.status === "ERROR");

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Overview for the last ${rangeDays} days across AI Voice and Web Dev`}
        actions={
          <div className="inline-flex rounded-xl border bg-surface p-1">
            {RANGES.map((r) => (
              <Link
                key={r.v}
                href={`/?range=${r.v}`}
                className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", rangeDays === r.v ? "bg-accent text-accent-fg shadow-sm" : "text-muted hover:text-fg")}
              >
                {r.label}
              </Link>
            ))}
          </div>
        }
      />

      {/* Headline figures */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Headline label="Revenue" value={money(k.revenue.value)} delta={k.revenue.delta} icon={DollarSign} tone="bg-sky-500/10 text-sky-600" />
        <Headline label="New leads" value={String(k.totalLeads.value)} delta={k.totalLeads.delta} icon={Users} tone="bg-indigo-500/10 text-indigo-600" />
        <Headline label="Customers won" value={String(k.customers.value)} delta={k.customers.delta} icon={BadgeCheck} tone="bg-emerald-500/10 text-emerald-600" />
        <Headline label="Lead → customer" value={`${k.conversion.value}%`} icon={TrendingUp} tone="bg-fuchsia-500/10 text-fuchsia-600" />
      </div>


      {/* Lead volume + needs attention */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Lead volume" subtitle="New leads per service" />
          <div className="px-3 pb-4">
            <LeadsAreaChart data={s.series} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Needs attention" subtitle="Work waiting on your team" />
          <ul className="divide-y px-2 pb-2">
            <li>
              <Link href="/inbox" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600"><Inbox size={16} /></span>
                <span className="flex-1 text-sm">Unread messages</span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums", unreadCount ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted")}>{unreadCount}</span>
              </Link>
            </li>
            <li>
              <Link href="/leads" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><UserPlus size={16} /></span>
                <span className="flex-1 text-sm">Unassigned open leads</span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums", unassigned ? "bg-amber-500 text-white" : "bg-surface-2 text-muted")}>{unassigned}</span>
              </Link>
            </li>
            <li>
              <Link href="/connections" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><Link2 size={16} /></span>
                <span className="flex-1 text-sm">Channels connected</span>
                <span className="text-sm font-semibold tabular-nums">{connected}<span className="font-normal text-muted"> / {channels.length}</span></span>
              </Link>
            </li>
          </ul>
          {failing.length > 0 && (
            <p className="mx-5 mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              Check failed for {failing.map((c) => c.name).join(", ")}. <Link href="/connections" className="font-medium underline">Fix on Connections</Link>
            </p>
          )}
        </Card>
      </div>

      {/* Service breakdown */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {s.byService.map((b) => {
          const meta = SERVICE_META[b.service];
          const Icon = SERVICE_ICON[b.service as keyof typeof SERVICE_ICON] ?? Globe;
          const share = totalLeads ? Math.round((b.leads / totalLeads) * 100) : 0;
          return (
            <Card key={b.service} className="p-5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", meta.bg, meta.text)}><Icon size={16} /></span>
                  {meta.label}
                </span>
                <span className="text-xs text-muted">{share}% of leads</span>
              </div>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-2xl font-semibold tabular-nums">{b.leads}</p>
                  <p className="text-xs text-muted">leads</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold tabular-nums">{money(b.revenue)}</p>
                  <p className="text-xs text-muted">revenue</p>
                </div>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full" style={{ width: `${share}%`, background: meta.color }} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Pipeline + activity */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Pipeline" subtitle="Where leads are in the funnel" />
          <div className="px-5 pb-5">
            <Funnel data={s.funnel} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent activity" />
          <ul className="space-y-4 px-5 pb-5">
            {s.activity.length === 0 && <Empty title="No activity yet" />}
            {s.activity.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                <div className="min-w-0">
                  <p className="leading-snug">
                    <span className="font-medium">{a.lead.contact.name}</span> <span className="text-muted">— {a.text}</span>
                  </p>
                  <p className="text-xs text-muted">{timeAgo(a.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Team workload */}
      <Card className="mt-4">
        <CardHeader
          title="Team workload"
          subtitle="Open leads and results per team member"
          action={<Link href="/team" className="text-xs font-medium text-accent hover:underline">Manage team</Link>}
        />
        {team.length === 0 ? (
          <div className="px-5 pb-5"><Empty title="No team members yet" /></div>
        ) : (
          <ul className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-3">
            {team.map((m) => (
              <li key={m.id}>
                <Link href={`/team/${m.id}`} className="block rounded-xl border p-4 transition hover:border-accent/40 hover:bg-surface-2/50">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} color={m.avatarColor} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="truncate text-xs text-muted">{m.title ?? "Team member"}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{m.openLeads}<span className="font-normal text-muted"> open</span></span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(m.openLeads / maxOpen) * 100}%` }} />
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-muted">
                    <span>{m.won} won</span>
                    <span className="font-medium text-fg tabular-nums">{money(m.revenue, true)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Latest leads */}
      <Card className="mt-4">
        <CardHeader title="Latest leads" action={<Link href="/leads" className="text-xs font-medium text-accent hover:underline">View all</Link>} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y bg-surface-2/60 text-left text-xs text-muted">
                <th className="px-5 py-2.5 font-medium">Contact</th>
                <th className="px-3 py-2.5 font-medium">Service</th>
                <th className="px-3 py-2.5 font-medium">Score</th>
                <th className="px-3 py-2.5 font-medium">Assigned</th>
                <th className="px-5 py-2.5 text-right font-medium">Captured</th>
              </tr>
            </thead>
            <tbody>
              {s.recent.map((l) => (
                <tr key={l.id} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="px-5 py-3">
                    <Link href={`/leads?open=${l.id}`} className="font-medium hover:text-accent">{l.contact.name}</Link>
                    <p className="max-w-xs truncate text-xs text-muted">{l.title}</p>
                  </td>
                  <td className="px-3 py-3"><ServiceBadge service={l.service} /></td>
                  <td className="px-3 py-3"><ScoreBadge score={l.score} /></td>
                  <td className="px-3 py-3">
                    {l.assignedAgent === "AI" ? (
                      <span className="text-xs font-medium text-violet-600">AI agent</span>
                    ) : l.assignedUser ? (
                      <span className="flex items-center gap-2"><Avatar name={l.assignedUser.name} color={l.assignedUser.avatarColor} size={22} />{l.assignedUser.name}</span>
                    ) : (
                      <span className="text-xs text-muted">Unassigned</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-muted">{timeAgo(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
