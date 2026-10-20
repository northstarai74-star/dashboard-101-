import { db } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { EngagementView } from "@/components/engagement-view";
import { requireAdmin } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function EngagementPage() {
  await requireAdmin();
  const [comments, enquiries] = await Promise.all([
    db.comment.findMany({ orderBy: [{ handled: "asc" }, { createdAt: "desc" }], take: 100 }),
    db.enquiry.findMany({ orderBy: [{ handled: "asc" }, { createdAt: "desc" }], take: 100 }),
  ]);
  return (
    <>
      <PageHeader title="Comments & Enquiries" subtitle="Triage Instagram comments and lead-ad form submissions" />
      <EngagementView
        comments={comments.map((c) => ({ id: c.id, author: c.author, text: c.text, postRef: c.postRef, handled: c.handled, leadId: c.leadId, createdAt: c.createdAt.toISOString() }))}
        enquiries={enquiries.map((e) => ({ id: e.id, formName: e.formName, name: e.name, email: e.email, phone: e.phone, message: e.message, handled: e.handled, leadId: e.leadId, createdAt: e.createdAt.toISOString() }))}
      />
    </>
  );
}
