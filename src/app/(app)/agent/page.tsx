import { PageHeader } from "@/components/shell";
import { AgentConsole } from "@/components/agent-console";

export const dynamic = "force-dynamic";

export default function AgentPage() {
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
