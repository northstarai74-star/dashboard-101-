"use client";

import * as React from "react";
import { Send, Wrench, CheckCircle2, XCircle } from "lucide-react";
import { Button, Card, CardHeader } from "./ui";
import { cn } from "@/lib/utils";

type ToolRun = { tool: string; input: unknown; ok: boolean; result: unknown };
type Turn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; mode: "live" | "offline"; actions: ToolRun[] };

const COMMANDS = [
  "How is the business doing this month?",
  "How close are we to the $10k goal?",
  "Show the newest leads",
  "Show leads in the proposal stage",
  "Which channels are connected?",
];

export function AgentConsole() {
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  async function send(message: string) {
    const msg = message.trim();
    if (!msg || busy) return;
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((t) => [...t, { role: "user", content: msg }]);
    setText("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The agent could not run that command.");
      setTurns((t) => [...t, { role: "assistant", content: data.reply, mode: data.mode, actions: data.actions }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <Card className="flex min-h-[60vh] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {turns.length === 0 && (
            <p className="text-sm text-muted">Try a command below, or type your own. Example: &quot;move lead abc to proposal&quot; or &quot;add a note to lead abc: called back Monday&quot;.</p>
          )}
          {turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-accent-fg">
                {t.content}
              </div>
            ) : (
              <div key={i} className="max-w-[90%] space-y-2">
                {t.actions.length > 0 && (
                  <ul className="space-y-1.5">
                    {t.actions.map((a, j) => (
                      <li key={j} className="flex items-start gap-2 rounded-lg border bg-surface px-3 py-2 text-xs">
                        {a.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" /> : <XCircle size={14} className="mt-0.5 shrink-0 text-rose-600" />}
                        <div className="min-w-0">
                          <p className="font-mono font-medium">{a.tool}</p>
                          <p className="truncate text-muted">{JSON.stringify(a.input)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="whitespace-pre-line rounded-2xl rounded-bl-md border bg-surface px-4 py-2.5 text-sm">{t.content}</div>
                {t.mode === "offline" && <p className="text-xs text-muted">Offline answer. Turn off demo mode and add a Claude key for free-form commands.</p>}
              </div>
            ),
          )}
          {busy && <p className="flex items-center gap-2 text-sm text-muted"><Wrench size={14} className="animate-pulse" /> Working…</p>}
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div ref={endRef} />
        </div>

        <form
          className="flex gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Give the agent a command…"
            disabled={busy}
            className="h-10 flex-1 rounded-xl border bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <Button type="submit" disabled={busy || !text.trim()}>
            <Send size={15} /> Run
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <CardHeader title="Quick commands" />
        <div className="mt-3 flex flex-col gap-2">
          {COMMANDS.map((c) => (
            <button
              key={c}
              type="button"
              disabled={busy}
              onClick={() => send(c)}
              className={cn("rounded-xl border px-3 py-2 text-left text-sm transition hover:border-accent hover:bg-accent/5", busy && "opacity-50")}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="mt-5 text-xs text-muted">
          The agent can read your numbers, goals, leads and connections, change a lead&apos;s stage and add internal notes. It cannot message customers, spend money or delete records.
        </p>
      </Card>
    </div>
  );
}
