import { getMarketingSnapshot } from "@/lib/marketing";
import { PageHeader } from "@/components/shell";
import { MarketingView } from "@/components/marketing-view";
import { requireAdmin } from "@/lib/access";

export default async function MarketingPage() {
  await requireAdmin();
  const snapshot = await getMarketingSnapshot();
  return (
    <>
      <PageHeader
        title="Marketing"
        subtitle="New leads per month by source, your monthly target, and what each lead costs in ad spend."
      />
      <MarketingView snapshot={snapshot} />
    </>
  );
}
