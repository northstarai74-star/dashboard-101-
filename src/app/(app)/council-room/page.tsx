import { db } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { Card } from "@/components/ui";
import { DebateRoom, type DebateRow } from "@/components/debate-room";
import { requireAdmin } from "@/lib/access";

export const dynamic = "force-dynamic";

// The Roast Room runs as its own server (see council-room/). Point this at wherever it is hosted.
const ROOM_URL = process.env.ROOM_URL || "http://localhost:4730";

async function roomIsUp() {
  try {
    const res = await fetch(`${ROOM_URL}/api/seats`, { cache: "no-store", signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function CouncilRoomPage() {
  await requireAdmin();
  const [up, debates] = await Promise.all([
    roomIsUp(),
    db.debateResult.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const rows: DebateRow[] = debates.map((d) => ({
    id: d.id,
    question: d.question,
    mode: d.mode,
    verdict: d.verdict,
    actions: d.actions as string[],
    advisors: d.advisors as { name: string; advice: string }[],
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader title="Council Room" subtitle="Seven advisors argue out your business decisions, live around the table." />
      {up ? (
        <Card className="overflow-hidden p-0">
          <iframe
            src={ROOM_URL}
            title="Council Room"
            className="block h-[80vh] min-h-[560px] w-full border-0"
            allow="clipboard-write"
          />
        </Card>
      ) : (
        <Card className="p-6">
          <p className="font-semibold">The Council Room is offline.</p>
          <p className="mt-2 text-sm text-muted">
            Start the app with <code className="rounded bg-muted/20 px-1">npm run dev</code>, which runs the room alongside it, or run{" "}
            <code className="rounded bg-muted/20 px-1">npm run room</code> on its own. It serves on {ROOM_URL}.
          </p>
        </Card>
      )}
      <DebateRoom initial={rows} />
    </>
  );
}
