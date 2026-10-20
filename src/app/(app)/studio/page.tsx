import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/shell";
import { StudioView } from "@/components/studio-view";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const [creatives, settings, keys] = await Promise.all([
    db.creative.findMany({ relationLoadStrategy: "join", where: me.role === "ADMIN" ? {} : { userId: me.id }, orderBy: { createdAt: "desc" }, take: 60, include: { user: { select: { name: true } } } }),
    getSettings(),
    db.apiKey.count({ where: { provider: "HIGGSFIELD", status: "ACTIVE" } }),
  ]);

  return (
    <>
      <PageHeader title="Creative Studio" subtitle="Generate images for posts, reels and ads with Higgsfield" />
      <StudioView
        demoMode={settings.demoMode}
        hasKey={keys > 0}
        creatives={creatives.map((c) => ({
          id: c.id,
          prompt: c.prompt,
          aspect: c.aspect,
          status: c.status,
          imageUrl: c.imageUrl,
          error: c.error,
          author: c.user?.name ?? null,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
