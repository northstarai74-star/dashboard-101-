import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";

const TodoInput = z.object({
  title: z.string().trim().min(1, "Write what needs doing").max(200),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
});

export const GET = route(async () =>
  json(await db.todo.findMany({ orderBy: [{ done: "asc" }, { createdAt: "desc" }], take: 200 })),
);

export const POST = route(async (req) => {
  const input = TodoInput.parse(await req.json());
  const todo = await db.todo.create({
    data: {
      title: input.title,
      dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null,
    },
  });
  return json(todo, 201);
});
