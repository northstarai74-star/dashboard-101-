import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const TodoPatch = z.object({
  title: z.string().trim().min(1, "Write what needs doing").max(200).optional(),
  done: z.boolean().optional(),
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const input = TodoPatch.parse(await req.json());
  const todo = await db.todo.update({ where: { id }, data: input }).catch(() => null);
  if (!todo) return json({ error: "Not found" }, 404);
  return json(todo);
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await db.todo.delete({ where: { id } }).catch(() => null);
  return json({ ok: true });
});
