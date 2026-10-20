import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/access";
import { memberWorkspace } from "@/lib/member";
import { PageHeader } from "@/components/shell";
import { MemberBadge, MemberWorkspace } from "@/components/member-workspace";

export const dynamic = "force-dynamic";

/** The owner's view of one team member's workspace: the same numbers that person sees on their own dashboard. */
export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const w = await memberWorkspace(id);
  if (!w.user) notFound();

  return (
    <>
      <Link href="/team" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ChevronLeft size={16} /> Team</Link>
      <PageHeader title={`${w.user.name}'s workspace`} subtitle="What this team member sees on their own dashboard" actions={<MemberBadge user={w.user} />} />
      <MemberWorkspace w={w} asOwner />
    </>
  );
}
