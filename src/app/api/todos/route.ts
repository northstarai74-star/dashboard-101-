import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { isAdmin } from "@/lib/access";

const TodoInput = z.object({
  title: z.string().trim().min(1, "Write what needs doing").max(200),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  // Admins can hand a task to a team member; everyone else's tasks are their own.
  userId: z.string().optional(),
});

/** Admins see every to-do; a team member sees only their own. */
export const GET = route(async (_req, _ctx, me) =>
  json(await db.todo.findMany({ where: isAdmin(me) ? {} : { userId: me.id }, orderBy: [{ done: "asc" }, { createdAt: "desc" }], take: 200 })),
);

export const POST = route(async (req, _ctx, me) => {
  const input = TodoInput.parse(await req.json());
  let userId = me.id;
  if (input.userId && input.userId !== me.id) {
    if (!isAdmin(me)) return json({ error: "You can only add to-dos for yourself" }, 403);
    if (!(await db.user.findUnique({ where: { id: input.userId }, select: { id: true } }))) return json({ error: "Team member not found" }, 400);
    userId = input.userId;
  }
  const todo = await db.todo.create({
    data: {
      title: input.title,
      userId,
      dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null,
    },
  });
  return json(todo, 201);
});
