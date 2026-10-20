import { getGoalSnapshot } from "@/lib/goals";
import { PageHeader } from "@/components/shell";
import { Card, CardHeader } from "@/components/ui";
import { cn, money } from "@/lib/utils";
import { requireAdmin } from "@/lib/access";

export const dynamic = "force-dynamic";

function ProgressCard({ label, value, target, progress, note }: { label: string; value: string; target: string; progress: number; note: string }) {
  const done = progress >= 100;
  return (
    <div className="rounded-2xl border bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", done ? "bg-emerald-500/10 text-emerald-600" : "bg-accent/10 text-accent")}>
          {progress}%
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
        {value} <span className="text-base font-normal text-muted">/ {target}</span>
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted/20">
        <div className={cn("h-full rounded-full transition-all", done ? "bg-emerald-500" : "bg-accent")} style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">{note}</p>
    </div>
  );
}

export default async function GoalsPage() {
  await requireAdmin();
  const s = await getGoalSnapshot();
  const { goals } = s;
  const maxRevenue = Math.max(goals.targetMrr, ...s.monthly.map((m) => m.revenue));

  return (
    <>
      <PageHeader
        title="Goals"
        subtitle={`Launch target: ${money(goals.targetMrr)} recurring revenue a month from ${goals.targetClients} clients at ${money(goals.pricePerClient)} each.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ProgressCard
          label="Monthly recurring revenue"
          value={money(s.mrr)}
          target={money(goals.targetMrr)}
          progress={s.mrrProgress}
          note={s.mrrGap > 0 ? `${money(s.mrrGap)} to go` : "Target reached"}
        />
        <ProgressCard
          label="Paying clients"
          value={String(s.activeClients)}
          target={String(goals.targetClients)}
          progress={s.clientProgress}
          note={s.clientsNeeded > 0 ? `${s.clientsNeeded} more client${s.clientsNeeded === 1 ? "" : "s"} needed` : "Client target reached"}
        />
        <ProgressCard
          label="Average per client"
          value={money(s.avgPerClient)}
          target={money(goals.pricePerClient)}
          progress={Math.min(100, Math.round((s.avgPerClient / goals.pricePerClient) * 100))}
          note="Last 30 days, paid clients only"
        />
        <ProgressCard
          label="Open pipeline"
          value={money(s.pipelineValue)}
          target={money(s.mrrGap)}
          progress={s.mrrGap > 0 ? Math.min(100, Math.round((s.pipelineValue / s.mrrGap) * 100)) : 100}
          note={`${s.openLeads} open lead${s.openLeads === 1 ? "" : "s"} vs the remaining gap`}
        />
      </div>

      <Card className="mt-4 p-5">
        <CardHeader title="Monthly revenue, last 6 months" subtitle={`Dashed line marks the ${money(goals.targetMrr)} target`} />
        <div className="relative mt-6 flex h-56 items-end gap-3">
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-emerald-500/60" style={{ bottom: `${(goals.targetMrr / maxRevenue) * 100}%` }} />
          {s.monthly.map((m) => (
            <div key={m.label} className="flex h-full flex-1 flex-col justify-end gap-2">
              <span className="text-center text-xs font-medium tabular-nums text-muted">{m.revenue ? money(m.revenue, true) : "-"}</span>
              <div className="rounded-t-lg bg-accent" style={{ height: `${Math.max(2, (m.revenue / maxRevenue) * 100)}%` }} />
              <span className="text-center text-xs text-muted">
                {m.label} · {m.clients} client{m.clients === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <CardHeader title="How the numbers are calculated" />
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>MRR is the sum of PAID deals in the last 30 days. Clients are the distinct leads who paid in that window.</li>
          <li>Converting a lead to a client records a PAID deal, which feeds this dashboard.</li>
          <li>Targets are set in <code className="rounded bg-muted/20 px-1">src/lib/goals.ts</code>.</li>
        </ul>
      </Card>
    </>
  );
}
