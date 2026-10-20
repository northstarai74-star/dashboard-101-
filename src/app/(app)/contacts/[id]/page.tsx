import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { contactScope, leadScope } from "@/lib/access";
import { Avatar, Card, CardHeader, ScoreBadge, ServiceBadge, StageBadge } from "@/components/ui";
import { ContactEditor } from "@/components/contact-editor";
import { SOURCE_META } from "@/lib/constants";
import { money, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const c = await db.contact.findFirst({
    where: { id, ...contactScope(me) },
    include: {
      leads: { where: leadScope(me), orderBy: { createdAt: "desc" }, include: { deals: true, assignedUser: { select: { name: true } } } },
      conversations: { include: { messages: { orderBy: { sentAt: "desc" }, take: 1 } } },
    },
  });
  if (!c) notFound();
  const ltv = c.leads.flatMap((l) => l.deals).reduce((s, d) => s + d.amount, 0);

  return (
    <>
      <Link href="/contacts" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ChevronLeft size={16} /> Contacts</Link>
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={c.name} color="#64748b" size={56} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
          <p className="text-sm text-muted">{c.company ?? "No company"} · {SOURCE_META[c.source]} · added {timeAgo(c.createdAt)}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted">Lifetime value</p>
          <p className="text-2xl font-semibold tabular-nums">{money(ltv)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Leads & deals" subtitle={`${c.leads.length} total`} />
          <ul className="divide-y">
            {c.leads.map((l) => (
              <li key={l.id}>
                <Link href={`/leads?open=${l.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-surface-2/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.title}</p>
                    <p className="text-xs text-muted">{timeAgo(l.createdAt)}{l.assignedUser ? ` · ${l.assignedUser.name}` : ""}</p>
                  </div>
                  <ServiceBadge service={l.service} /> <StageBadge stage={l.stage} /> <ScoreBadge score={l.score} />
                  <span className="w-20 text-right text-sm font-medium tabular-nums">{l.deals.length ? money(l.deals.reduce((s, d) => s + d.amount, 0)) : "—"}</span>
                </Link>
              </li>
            ))}
          </ul>
          {c.conversations.length > 0 && (
            <div className="border-t px-5 py-3 text-sm">
              <Link href={`/inbox?c=${c.conversations[0].id}`} className="font-medium text-accent hover:underline">Open Instagram conversation →</Link>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Details" />
          <div className="px-5 pb-5">
            <ContactEditor contact={{ id: c.id, name: c.name, email: c.email, phone: c.phone, instagramHandle: c.instagramHandle, company: c.company, notes: c.notes }} />
          </div>
        </Card>
      </div>
    </>
  );
}
