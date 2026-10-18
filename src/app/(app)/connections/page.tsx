import { getCurrentUser } from "@/lib/session";
import { listChannels } from "@/lib/connections";
import { PageHeader } from "@/components/shell";
import { ConnectionsView } from "@/components/connections-view";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const [me, channels] = await Promise.all([getCurrentUser(), listChannels()]);
  return (
    <>
      <PageHeader title="Connections" subtitle="Link your channels and finance accounts. Each one is checked against its provider's API." />
      <ConnectionsView channels={channels} isAdmin={me?.role === "ADMIN"} />
    </>
  );
}
