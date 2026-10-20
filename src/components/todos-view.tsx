"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Empty, Input, Select } from "./ui";
import { cn } from "@/lib/utils";

export type TodoRow = { id: string; title: string; done: boolean; dueDate: string | null; assignee: string | null };

async function request(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data;
}

export function TodosView({ initial, people, meId, showAssignee }: { initial: TodoRow[]; people: { id: string; name: string }[]; meId: string; showAssignee: boolean }) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [who, setWho] = React.useState(meId);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const open = initial.filter((t) => !t.done);
  const finished = initial.filter((t) => t.done);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    run(async () => {
      await request("/api/todos", {
        method: "POST",
        body: JSON.stringify({ title, dueDate: dueDate || null, userId: who }),
      });
      setTitle("");
      setDueDate("");
    });
  }

  const toggle = (t: TodoRow) => run(() => request(`/api/todos/${t.id}`, { method: "PATCH", body: JSON.stringify({ done: !t.done }) }));
  const remove = (t: TodoRow) => run(() => request(`/api/todos/${t.id}`, { method: "DELETE" }));

  return (
    <>
      <Card className="p-5">
        <form onSubmit={add} className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            maxLength={200}
            className="flex-1"
            aria-label="New to-do"
          />
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="sm:w-44" aria-label="Due date" />
          {people.length > 1 && (
            <Select value={who} onChange={(e) => setWho(e.target.value)} className="sm:w-44" aria-label="Assign to">
              {people.map((p) => <option key={p.id} value={p.id}>{p.id === meId ? "Me" : p.name}</option>)}
            </Select>
          )}
          <Button type="submit" disabled={busy || !title.trim()}>
            Add to-do
          </Button>
        </form>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </Card>

      <Card className="mt-4 p-5">
        <CardHeader title="To do" subtitle={`${open.length} open`} />
        {open.length === 0 ? (
          <Empty title="Nothing left to do" hint="Add a task above to get started." />
        ) : (
          <ul className="mt-3 divide-y">
            {open.map((t) => (
              <TodoItem key={t.id} todo={t} busy={busy} showAssignee={showAssignee} onToggle={toggle} onDelete={remove} />
            ))}
          </ul>
        )}
      </Card>

      {finished.length > 0 && (
        <Card className="mt-4 p-5">
          <CardHeader title="Done" subtitle={`${finished.length} completed`} />
          <ul className="mt-3 divide-y">
            {finished.map((t) => (
              <TodoItem key={t.id} todo={t} busy={busy} showAssignee={showAssignee} onToggle={toggle} onDelete={remove} />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function TodoItem({
  todo,
  busy,
  showAssignee,
  onToggle,
  onDelete,
}: {
  todo: TodoRow;
  busy: boolean;
  showAssignee: boolean;
  onToggle: (t: TodoRow) => void;
  onDelete: (t: TodoRow) => void;
}) {
  return (
    <li className="flex items-center gap-3 py-3">
      <input
        type="checkbox"
        checked={todo.done}
        disabled={busy}
        onChange={() => onToggle(todo)}
        className="h-4 w-4 cursor-pointer accent-[var(--accent,#6366f1)]"
        aria-label={`Mark "${todo.title}" as ${todo.done ? "not done" : "done"}`}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", todo.done && "text-muted line-through")}>{todo.title}</p>
        {(todo.dueDate || showAssignee) && (
          <p className="text-xs text-muted">
            {todo.dueDate && `Due ${todo.dueDate}`}
            {todo.dueDate && showAssignee && " · "}
            {showAssignee && (todo.assignee ?? "Owner")}
          </p>
        )}
      </div>
      <button
        onClick={() => onDelete(todo)}
        disabled={busy}
        className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-red-500 disabled:opacity-50"
        aria-label={`Delete "${todo.title}"`}
      >
        <Trash2 size={16} />
      </button>
    </li>
  );
}
