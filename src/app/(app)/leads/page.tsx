import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { leadScope } from "@/lib/access";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell";
import { LeadsView } from "@/components/leads-view";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ q?: string; open?: string; service?: string }> }) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const admin = me.role === "ADMIN";
  const [leads, users] = await Promise.all([
    db.lead.findMany({
      relationLoadStrategy: "join",
      where: leadScope(me),
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: { contact: { select: { id: true, name: true, instagramHandle: true, email: true, phone: true, company: true } } },
    }),
    // A team member can only assign leads to themselves, so only their own name is offered.
    db.user.findMany({ where: admin ? {} : { id: me.id }, select: { id: true, name: true, avatarColor: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title={admin ? "Leads" : "My leads"}
        subtitle={admin ? "Everything captured from Instagram DMs, comments and Meta lead ads" : "Leads assigned to you, plus unassigned ones you can pick up"}
      />
      <LeadsView
        initialQuery={sp.q ?? ""}
        initialOpen={sp.open ?? null}
        initialService={sp.service ?? "ALL"}
        canBulk={admin}
        users={users}
        leads={leads.map((l) => ({
          id: l.id,
          title: l.title,
          source: l.source,
          service: l.service,
          stage: l.stage,
          score: l.score,
          assignedAgent: l.assignedAgent,
          assignedUserId: l.assignedUserId,
          estimatedValue: l.estimatedValue,
          createdAt: l.createdAt.toISOString(),
          contact: l.contact,
        }))}
      />
    </>
  );
}
