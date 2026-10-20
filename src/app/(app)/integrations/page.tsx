import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getConnection } from "@/lib/meta";
import { PageHeader } from "@/components/shell";
import { IntegrationsView } from "@/components/integrations-view";
import { requireAdmin } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  await requireAdmin();
  const me = await getCurrentUser();
  const [keys, conn, settings] = await Promise.all([
    db.apiKey.findMany({
      orderBy: [{ provider: "asc" }, { priority: "asc" }],
      select: { id: true, provider: true, label: true, keyHint: true, status: true, priority: true, usageCount: true, lastUsedAt: true, lastError: true },
    }),
    getConnection(),
    getSettings(),
  ]);
  const base = process.env.APP_URL ?? "http://localhost:3000";

  return (
    <>
      <PageHeader title="Integrations" subtitle="Connect Meta, Claude and Higgsfield. Add several keys per provider and the OS rotates between them automatically." />
      <IntegrationsView
        isAdmin={me?.role === "ADMIN"}
        demoMode={settings.demoMode}
        webhookUrl={`${base}/api/meta/webhook`}
        meta={{
          appId: conn.appId ?? "",
          pageId: conn.pageId ?? "",
          igBusinessId: conn.igBusinessId ?? "",
          verifyToken: conn.verifyToken,
          hasSecret: !!conn.appSecretEnc,
          hasToken: !!conn.accessTokenEnc,
          connected: conn.connected,
          lastSyncAt: conn.lastSyncAt?.toISOString() ?? null,
        }}
        keys={keys.map((k) => ({ ...k, lastUsedAt: k.lastUsedAt?.toISOString() ?? null }))}
      />
    </>
  );
}
