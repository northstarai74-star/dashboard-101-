import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getShellData } from "@/lib/shell-data";
import { Shell } from "@/components/shell";
import { AssistantWidget } from "@/components/assistant-widget";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { unread, comments, settings } = await getShellData(user.id, user.role === "ADMIN");

  return (
    <Shell user={user} counts={{ inbox: unread, comments }} demoMode={settings.demoMode}>
      {children}
      {user.role === "ADMIN" && <AssistantWidget />}
    </Shell>
  );
}
