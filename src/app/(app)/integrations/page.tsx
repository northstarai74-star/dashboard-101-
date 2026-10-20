import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getConnection } from "@/lib/meta";
import { listChannels } from "@/lib/connections";
import { PageHeader } from "@/components/shell";
import { IntegrationsView } from "@/components/integrations-view";
import { ConnectionsView } from "@/components/connections-view";
import { requireAdmin } from "@/lib/access";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "tools", label: "Channels & tools" },
  { id: "meta", label: "Meta & AI keys" },
] as const;

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const tab = (await searchParams).tab === "meta" ? "meta" : "tools";
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  return (
    <>
      <PageHeader
        title="Integrations"
        subtitle="Connect every channel and marketing tool in one place: WhatsApp, Telegram, Instagram, LinkedIn, YouTube, email and ad platforms, finance, and your Meta and AI keys."
      />
      <nav aria-label="Integration sections" className="mb-6 inline-flex rounded-xl border bg-surface-2 p-1 text-sm font-medium">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "tools" ? "/integrations" : `/integrations?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn("rounded-lg px-4 py-1.5 transition", tab === t.id ? "bg-surface shadow-sm" : "text-muted hover:text-fg")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "tools" ? <ToolsTab appUrl={base} /> : <MetaTab appUrl={base} />}
    </>
  );
}

async function ToolsTab({ appUrl }: { appUrl: string }) {
  const channels = await listChannels();
  return <ConnectionsView channels={channels} isAdmin appUrl={appUrl} />;
}

async function MetaTab({ appUrl }: { appUrl: string }) {
  const [keys, conn, settings] = await Promise.all([
    db.apiKey.findMany({
      orderBy: [{ provider: "asc" }, { priority: "asc" }],
      select: { id: true, provider: true, label: true, keyHint: true, status: true, priority: true, usageCount: true, lastUsedAt: true, lastError: true },
    }),
    getConnection(),
    getSettings(),
  ]);
  return (
    <IntegrationsView
      isAdmin
      demoMode={settings.demoMode}
      webhookUrl={`${appUrl}/api/meta/webhook`}
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
  );
}
