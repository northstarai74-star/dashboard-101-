import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { contactScope, leadScope } from "@/lib/access";
import { PageHeader } from "@/components/shell";
import { ContactsView } from "@/components/contacts-view";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const admin = me.role === "ADMIN";
  const contacts = await db.contact.findMany({
    where: contactScope(me),
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: { leads: {
      where: leadScope(me), include: { assignedUser: { select: { name: true, avatarColor: true } }, deals: true } } },
  });

  return (
    <>
      <PageHeader title={admin ? "Contacts" : "My contacts"} subtitle={admin ? "Your CRM — everyone who has reached out or bought" : "People behind your leads"} />
      <ContactsView
        canAdd={admin}
        contacts={contacts.map((c) => {
          const owner = c.leads.find((l) => l.assignedUser)?.assignedUser ?? null;
          return {
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            instagramHandle: c.instagramHandle,
            company: c.company,
            source: c.source,
            leadCount: c.leads.length,
            services: [...new Set(c.leads.map((l) => l.service))],
            lifetimeValue: c.leads.flatMap((l) => l.deals).reduce((s, d) => s + d.amount, 0),
            owner,
          };
        })}
      />
    </>
  );
}
