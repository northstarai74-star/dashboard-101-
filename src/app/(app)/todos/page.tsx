import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { PageHeader } from "@/components/shell";
import { TodosView } from "@/components/todos-view";

export const dynamic = "force-dynamic";

export default async function TodosPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const admin = me.role === "ADMIN";
  const [todos, people] = await Promise.all([
    db.todo.findMany({
      relationLoadStrategy: "join",
      where: admin ? {} : { userId: me.id },
      orderBy: [{ done: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: { user: { select: { name: true } } },
    }),
    admin ? db.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const rows = todos.map((t) => ({
    id: t.id,
    title: t.title,
    done: t.done,
    dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    assignee: t.user?.name ?? null,
  }));

  return (
    <>
      <PageHeader title={admin ? "To-do" : "My to-dos"} subtitle={admin ? "Your team's running task list. Give a task to anyone on the team." : "Your own task list."} />
      <TodosView initial={rows} people={people} meId={me.id} showAssignee={admin} />
    </>
  );
}
