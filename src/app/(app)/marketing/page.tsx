import Link from "next/link";
import { getMarketingSnapshot } from "@/lib/marketing";
import { listChannels } from "@/lib/connections";
import { PageHeader } from "@/components/shell";
import { MarketingView } from "@/components/marketing-view";
import { Card, CardHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/access";
import { cn } from "@/lib/utils";

const DOT = { CONNECTED: "bg-emerald-500", ERROR: "bg-rose-500", NOT_CONNECTED: "bg-slate-400" } as const;
const STATE = { CONNECTED: "Connected", ERROR: "Check failed", NOT_CONNECTED: "Not connected" } as const;

export default async function MarketingPage() {
  await requireAdmin();
  const [snapshot, channels] = await Promise.all([getMarketingSnapshot(), listChannels()]);
  const tools = channels.filter((c) => c.group === "MARKETING" || c.group === "MESSAGING" || c.group === "SOCIAL");
  const connected = tools.filter((c) => c.status === "CONNECTED").length;

  return (
    <>
      <PageHeader
        title="Marketing"
        subtitle="New leads per month by source, your monthly target, and what each lead costs in ad spend."
      />
      <Card className="mb-4">
        <CardHeader
          title="Your channels and tools"
          subtitle={`${connected} of ${tools.length} connected`}
          action={<Link href="/integrations" className="text-xs font-medium text-accent hover:underline">Manage on Integrations</Link>}
        />
        <ul className="grid gap-2 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tools.map((c) => (
            <li key={c.id}>
              <Link href="/integrations" className="flex items-center gap-3 rounded-xl border px-3 py-2.5 hover:bg-surface-2/60">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOT[c.status])} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-muted">{c.status === "CONNECTED" ? (c.accountLabel ?? STATE[c.status]) : STATE[c.status]}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <MarketingView snapshot={snapshot} />
    </>
  );
}
