import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { isAdmin } from "@/lib/access";

type Ctx = { params: Promise<{ id: string }> };

const TodoPatch = z.object({
  title: z.string().trim().min(1, "Write what needs doing").max(200).optional(),
  done: z.boolean().optional(),
});

/** A to-do can be changed by its owner or an admin. Ownerless (pre-accounts) to-dos are admin-only. */
const visibleTo = (me: { id: string; role: string }, id: string) => ({ id, ...(isAdmin(me) ? {} : { userId: me.id }) });

export const PATCH = route<Ctx>(async (req, { params }, me) => {
  const { id } = await params;
  const input = TodoPatch.parse(await req.json());
  const found = await db.todo.findFirst({ where: visibleTo(me, id), select: { id: true } });
  if (!found) return json({ error: "Not found" }, 404);
  return json(await db.todo.update({ where: { id }, data: input }));
});

export const DELETE = route<Ctx>(async (_req, { params }, me) => {
  const { id } = await params;
  await db.todo.deleteMany({ where: visibleTo(me, id) });
  return json({ ok: true });
});
