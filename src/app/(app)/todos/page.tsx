import { db } from "@/lib/db";
import { PageHeader } from "@/components/shell";
import { TodosView } from "@/components/todos-view";

export const dynamic = "force-dynamic";

export default async function TodosPage() {
  const todos = await db.todo.findMany({ orderBy: [{ done: "asc" }, { createdAt: "desc" }], take: 200 });
  const rows = todos.map((t) => ({
    id: t.id,
    title: t.title,
    done: t.done,
    dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
  }));

  return (
    <>
      <PageHeader title="To-do" subtitle="Your team's running task list." />
      <TodosView initial={rows} />
    </>
  );
}
