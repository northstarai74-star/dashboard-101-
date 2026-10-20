import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { conversationScope } from "@/lib/access";
import { PageHeader } from "@/components/shell";
import { InboxView } from "@/components/inbox-view";

export const dynamic = "force-dynamic";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const convos = await db.conversation.findMany({
    relationLoadStrategy: "join",
    where: conversationScope(me),
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      messages: { orderBy: { sentAt: "asc" } },
      contact: { include: { leads: { orderBy: { createdAt: "desc" }, take: 1, include: { assignedUser: { select: { name: true } } } } } },
    },
  });

  return (
    <>
      <PageHeader title="Inbox" subtitle="Every conversation from Instagram, WhatsApp, Telegram and LinkedIn in one place" />
      <InboxView
        initialId={c ?? convos[0]?.id ?? null}
        convos={convos.map((v) => ({
          id: v.id,
          platform: v.platform,
          unread: v.unread,
          lastMessageAt: v.lastMessageAt.toISOString(),
          contact: { id: v.contact.id, name: v.contact.name, handle: v.contact.instagramHandle ?? v.contact.phone ?? null, email: v.contact.email, phone: v.contact.phone },
          lead: v.contact.leads[0]
            ? { id: v.contact.leads[0].id, service: v.contact.leads[0].service, stage: v.contact.leads[0].stage, score: v.contact.leads[0].score, owner: v.contact.leads[0].assignedUser?.name ?? null }
            : null,
          messages: v.messages.map((m) => ({ id: m.id, direction: m.direction, text: m.text, byAi: m.byAi, sentAt: m.sentAt.toISOString() })),
        }))}
      />
    </>
  );
}
