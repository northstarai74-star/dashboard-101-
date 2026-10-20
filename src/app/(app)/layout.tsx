import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { conversationScope } from "@/lib/access";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { Shell } from "@/components/shell";
import { AssistantWidget } from "@/components/assistant-widget";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [inbox, comments, settings] = await Promise.all([
    db.conversation.aggregate({ where: conversationScope(user), _sum: { unread: true } }),
    user.role === "ADMIN" ? db.comment.count({ where: { handled: false } }) : Promise.resolve(0),
    getSettings(),
  ]);

  return (
    <Shell user={user} counts={{ inbox: inbox._sum.unread ?? 0, comments }} demoMode={settings.demoMode}>
      {children}
      {user.role === "ADMIN" && <AssistantWidget />}
    </Shell>
  );
}
