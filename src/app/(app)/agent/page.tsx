import { PageHeader } from "@/components/shell";
import { AgentConsole } from "@/components/agent-console";
import { requireAdmin } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        title="Command agent"
        subtitle="Give a command in plain English. The agent looks up your tools and records, and shows every step it took."
      />
      <AgentConsole />
    </>
  );
}
