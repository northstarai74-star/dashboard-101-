import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { PageHeader } from "@/components/shell";
import { TeamView } from "@/components/team-view";
import { requireAdmin } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  await requireAdmin();
  const me = await getCurrentUser();
  const [users, rules] = await Promise.all([
    db.user.findMany({
      relationLoadStrategy: "join",
      orderBy: { createdAt: "asc" },
      include: { leads: { select: { stage: true, service: true, deals: { select: { amount: true } } } } },
    }),
    db.assignmentRule.findMany(),
  ]);

  return (
    <>
      <PageHeader title="Team" subtitle="Who owns which leads, and how the load is split" />
      <TeamView
        isAdmin={me?.role === "ADMIN"}
        meId={me?.id ?? ""}
        rules={rules.map((r) => ({ service: r.service, agent: r.agent, userId: r.userId }))}
        members={users.map((u) => {
          const open = u.leads.filter((l) => !["WON", "LOST"].includes(l.stage));
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            title: u.title,
            role: u.role,
            avatarColor: u.avatarColor,
            openLeads: open.length,
            won: u.leads.filter((l) => l.stage === "WON").length,
            revenue: u.leads.flatMap((l) => l.deals).reduce((s, d) => s + d.amount, 0),
            services: [...new Set(open.map((l) => l.service))],
          };
        })}
      />
    </>
  );
}
