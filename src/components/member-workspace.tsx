import Link from "next/link";
import { CheckSquare, DollarSign, TrendingUp, UserPlus, Users } from "lucide-react";
import { memberWorkspace } from "@/lib/member";
import { Avatar, Card, CardHeader, Empty, ScoreBadge, ServiceBadge } from "./ui";
import { Funnel } from "./charts";
import { cn, money, timeAgo } from "@/lib/utils";

type Workspace = Awaited<ReturnType<typeof memberWorkspace>>;

function Stat({ label, value, sub, icon: Icon, tone }: { label: string; value: string; sub?: string; icon: typeof Users; tone: string }) {
  return (
    <div className="rounded-2xl border bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tone)}><Icon size={16} /></span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

/**
 * One team member's workspace. A member sees it as their dashboard; the owner opens it from the Team page
 * (`asOwner`) to see what that person sees, without the member-only shortcuts.
 */
export function MemberWorkspace({ w, asOwner = false }: { w: Workspace; asOwner?: boolean }) {
  const { kpis: k } = w;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open leads" value={String(k.open)} sub={`${k.won} won so far`} icon={Users} tone="bg-indigo-500/10 text-indigo-600" />
        <Stat label="Revenue closed" value={money(k.revenue)} sub={`${money(k.revenue30)} in the last 30 days`} icon={DollarSign} tone="bg-sky-500/10 text-sky-600" />
        <Stat label="Lead → customer" value={`${k.conversion}%`} sub="of all leads assigned" icon={TrendingUp} tone="bg-fuchsia-500/10 text-fuchsia-600" />
        <Stat label="Open to-dos" value={String(k.openTodos)} icon={CheckSquare} tone="bg-emerald-500/10 text-emerald-600" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Pipeline" subtitle="Where the leads are" />
          <div className="px-5 pb-5"><Funnel data={w.funnel} /></div>
        </Card>

        <Card>
          <CardHeader title="To-do" action={!asOwner ? <Link href="/todos" className="text-xs font-medium text-accent hover:underline">All to-dos</Link> : undefined} />
          {w.todos.length === 0 ? (
            <div className="px-5 pb-5"><Empty title="Nothing left to do" /></div>
          ) : (
            <ul className="divide-y px-5 pb-3">
              {w.todos.map((t) => (
                <li key={t.id} className="py-2.5 text-sm">
                  <p className="truncate font-medium">{t.title}</p>
                  {t.dueDate && <p className="text-xs text-muted">Due {t.dueDate.toISOString().slice(0, 10)}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent activity" />
          <ul className="space-y-4 px-5 pb-5">
            {w.activity.length === 0 && <Empty title="No activity yet" />}
            {w.activity.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                <div className="min-w-0">
                  <p className="leading-snug"><span className="font-medium">{a.lead.contact.name}</span> <span className="text-muted">— {a.text}</span></p>
                  <p className="text-xs text-muted">{timeAgo(a.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {!asOwner && w.unclaimed > 0 && (
        <Link href="/leads" className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm hover:bg-amber-500/15">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600"><UserPlus size={16} /></span>
          <span className="flex-1"><span className="font-semibold">{w.unclaimed} unassigned {w.unclaimed === 1 ? "lead is" : "leads are"} waiting.</span> Open My leads to pick one up.</span>
        </Link>
      )}

      <Card className="mt-4">
        <CardHeader title="Latest leads" action={!asOwner ? <Link href="/leads" className="text-xs font-medium text-accent hover:underline">View all</Link> : undefined} />
        {w.latest.length === 0 ? (
          <div className="px-5 pb-5"><Empty title="No leads assigned yet" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-surface-2/60 text-left text-xs text-muted">
                  <th className="px-5 py-2.5 font-medium">Contact</th>
                  <th className="px-3 py-2.5 font-medium">Service</th>
                  <th className="px-3 py-2.5 font-medium">Score</th>
                  <th className="px-5 py-2.5 text-right font-medium">Captured</th>
                </tr>
              </thead>
              <tbody>
                {w.latest.map((l) => (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-surface-2/50">
                    <td className="px-5 py-3">
                      <Link href={`/leads?open=${l.id}`} className="font-medium hover:text-accent">{l.contact.name}</Link>
                      <p className="max-w-xs truncate text-xs text-muted">{l.title}</p>
                    </td>
                    <td className="px-3 py-3"><ServiceBadge service={l.service} /></td>
                    <td className="px-3 py-3"><ScoreBadge score={l.score} /></td>
                    <td className="px-5 py-3 text-right text-xs text-muted">{timeAgo(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

export function MemberBadge({ user }: { user: NonNullable<Workspace["user"]> }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={user.name} color={user.avatarColor} size={44} />
      <div>
        <p className="font-semibold">{user.name}</p>
        <p className="text-xs text-muted">{user.title ?? (user.role === "ADMIN" ? "Admin" : "Team member")} · {user.email}</p>
      </div>
    </div>
  );
}
