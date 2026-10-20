import Link from "next/link";
import { db } from "@/lib/db";
import { getAnalyticsSnapshot } from "@/lib/analytics";
import { PageHeader } from "@/components/shell";
import { AnalyticsView } from "@/components/analytics-view";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/lib/access";

const RANGES = [7, 30, 90];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdmin();
  const { range } = await searchParams;
  const rangeDays = RANGES.includes(Number(range)) ? Number(range) : 30;
  const [snapshot, expenses] = await Promise.all([getAnalyticsSnapshot(rangeDays), db.expense.findMany({ orderBy: { date: "desc" }, take: 12 })]);

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Every channel and the money, in one place. Live where the app already sees the data; log or push the rest."
        actions={
          <div className="inline-flex rounded-xl border bg-surface p-1">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/analytics?range=${r}`}
                className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", rangeDays === r ? "bg-accent text-accent-fg shadow-sm" : "text-muted hover:text-fg")}
              >
                {r} days
              </Link>
            ))}
          </div>
        }
      />
      <AnalyticsView snapshot={snapshot} expenses={expenses.map((e) => ({ id: e.id, label: e.label, category: e.category, amount: e.amount, date: e.date.toISOString() }))} />
    </>
  );
}
