import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { isAdmin } from "@/lib/access";
import { FINAL_STATUSES, fetchJob } from "@/lib/higgsfield";

type Ctx = { params: Promise<{ id: string }> };

/** Returns the creative, refreshing its status from Higgsfield while the job is still running. */
export const GET = route<Ctx>(async (_req, { params }, me) => {
  const { id } = await params;
  const creative = await db.creative.findUnique({ where: { id } });
  if (!creative || (!isAdmin(me) && creative.userId !== me.id)) return json({ error: "Not found" }, 404);
  if (FINAL_STATUSES.includes(creative.status) || !creative.requestId) return json(creative);

  try {
    const job = await fetchJob(creative.requestId, creative.apiKeyId);
    const updated = await db.creative.update({
      where: { id },
      data: {
        status: job.status,
        imageUrl: job.images?.[0]?.url ?? creative.imageUrl,
        error: job.status === "nsfw" ? "Blocked by Higgsfield's content filter" : job.status === "failed" ? "Generation failed" : null,
      },
    });
    return json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Status check failed";
    // A missing key can never recover; transient errors leave the job running so the next poll retries.
    if (message.includes("was deleted")) {
      return json(await db.creative.update({ where: { id }, data: { status: "failed", error: message } }));
    }
    return json({ ...creative, error: message });
  }
});

export const DELETE = route<Ctx>(async (_req, { params }, me) => {
  const { id } = await params;
  await db.creative.deleteMany({ where: { id, ...(isAdmin(me) ? {} : { userId: me.id }) } });
  return json({ ok: true });
});
