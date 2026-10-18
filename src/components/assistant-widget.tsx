"use client";

import * as React from "react";
import { Bot, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = ["How is revenue vs expenses this month?", "Which channel is performing best?", "ask the council what should I focus on this week?"];

export function AssistantWidget() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Msg[]>([
    { role: "assistant", content: 'Hi! Ask me about your numbers. Type "ask the council" followed by a question to get advice from the seven advisors.' },
  ]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send only the conversation, not the greeting we added locally.
        body: JSON.stringify({ messages: next.slice(1).slice(-20) }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = res.ok ? data.content : data.error ?? "Something went wrong. Try again.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Network error. Check your connection and try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open ? (
        <div className="fixed bottom-20 right-4 z-50 flex max-h-[70vh] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-surface shadow-xl sm:right-6">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2 font-semibold">
              <Bot size={17} /> Business assistant
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close assistant">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2", m.role === "user" ? "bg-accent text-accent-fg" : "bg-surface-2")}>{m.content}</div>
              </div>
            ))}
            {busy ? <p className="text-xs text-muted">Thinking…</p> : null}
            <div ref={endRef} />
          </div>
          {messages.length <= 1 ? (
            <div className="flex flex-wrap gap-2 px-4 pb-2">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border px-3 py-1 text-xs text-muted hover:text-fg">
                  {s}
                </button>
              ))}
            </div>
          ) : null}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 border-t p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Ask anything, or "ask the council …"'
              className="min-w-0 flex-1 rounded-xl border bg-bg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
            <button type="submit" disabled={busy || !input.trim()} className="rounded-xl bg-accent px-3 text-accent-fg disabled:opacity-50" aria-label="Send">
              <Send size={16} />
            </button>
          </form>
        </div>
      ) : null}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg transition hover:scale-105 sm:right-6"
        aria-label={open ? "Close assistant" : "Open assistant"}
      >
        {open ? <X size={22} /> : <Bot size={24} />}
      </button>
    </>
  );
}
