"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Send, Sparkles, UserPlus } from "lucide-react";
import { Avatar, Button, Card, Empty, ScoreBadge, ServiceBadge, StageBadge } from "./ui";
import { cn, timeAgo } from "@/lib/utils";

const CHANNELS = [
  { id: "ALL", label: "All" },
  { id: "INSTAGRAM", label: "Instagram", cls: "bg-pink-500/10 text-pink-600" },
  { id: "WHATSAPP", label: "WhatsApp", cls: "bg-emerald-500/10 text-emerald-600" },
  { id: "LINKEDIN", label: "LinkedIn", cls: "bg-sky-500/10 text-sky-600" },
];
const chip = (platform: string) => CHANNELS.find((c) => c.id === platform)?.cls ?? "bg-slate-500/10 text-slate-600";
const chipLabel = (platform: string) => CHANNELS.find((c) => c.id === platform)?.label ?? platform;

type Msg = { id: string; direction: string; text: string; byAi?: boolean; sentAt: string };
type Convo = {
  id: string; platform: string; unread: number; lastMessageAt: string;
  contact: { id: string; name: string; handle: string | null; email: string | null; phone: string | null };
  lead: { id: string; service: string; stage: string; score: number; owner: string | null } | null;
  messages: Msg[];
};

async function post(url: string, body?: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export function InboxView({ convos, initialId }: { convos: Convo[]; initialId: string | null }) {
  const router = useRouter();
  const [activeId, setActiveId] = React.useState<string | null>(initialId);
  const [mobileThread, setMobileThread] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState("");
  const [err, setErr] = React.useState("");
  const [channel, setChannel] = React.useState("ALL");
  const visible = channel === "ALL" ? convos : convos.filter((c) => c.platform === channel);
  const endRef = React.useRef<HTMLDivElement>(null);
  const active = convos.find((c) => c.id === activeId) ?? null;
  const canReply = active?.platform === "INSTAGRAM";

  React.useEffect(() => {
    if (active && active.unread > 0) post(`/api/conversations/${active.id}/read`).then(() => router.refresh()).catch(() => {});
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [active?.id, active?.messages.length]);

  async function run(kind: string, fn: () => Promise<void>) {
    setBusy(kind);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy("");
  }

  const suggest = () => run("suggest", async () => setDraft((await post(`/api/conversations/${active!.id}/suggest`)).text));
  const send = () =>
    run("send", async () => {
      if (!draft.trim()) return;
      await post(`/api/conversations/${active!.id}/send`, { text: draft });
      setDraft("");
      router.refresh();
    });
  const makeLead = () => run("lead", async () => { await post(`/api/conversations/${active!.id}/lead`); router.refresh(); });

  return (
    <Card className="grid h-[calc(100vh-11rem)] min-h-[520px] overflow-hidden lg:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_300px]">
      {/* thread list */}
      <div className={cn("flex min-h-0 flex-col border-r", mobileThread && "hidden lg:flex")}>
        <div className="space-y-2 border-b px-3 py-3">
          <p className="text-sm font-semibold">Conversations <span className="font-normal text-muted">({visible.length})</span></p>
          <div role="tablist" aria-label="Channel" className="flex flex-wrap gap-1">
            {CHANNELS.map((ch) => {
              const n = ch.id === "ALL" ? convos.length : convos.filter((c) => c.platform === ch.id).length;
              return (
                <button key={ch.id} role="tab" aria-selected={channel === ch.id} onClick={() => setChannel(ch.id)}
                  className={cn("rounded-lg px-2.5 py-1 text-xs font-medium transition", channel === ch.id ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}>
                  {ch.label} <span className="opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {visible.map((c) => {
            const last = c.messages[c.messages.length - 1];
            return (
              <li key={c.id}>
                <button onClick={() => { setActiveId(c.id); setMobileThread(true); }} className={cn("flex w-full items-center gap-3 border-b px-4 py-3 text-left transition hover:bg-surface-2/60", c.id === activeId && "bg-accent/5")}>
                  <Avatar name={c.contact.name} color="#ec4899" size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>{c.contact.name}</p>
                      <span className="shrink-0 text-[11px] text-muted">{timeAgo(c.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("shrink-0 rounded px-1.5 text-[10px] font-semibold", chip(c.platform))}>{chipLabel(c.platform)}</span>
                      <p className="truncate text-xs text-muted">{last?.direction === "OUT" ? "You: " : ""}{last?.text}</p>
                    </div>
                  </div>
                  {c.unread > 0 && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                </button>
              </li>
            );
          })}
          {visible.length === 0 && <Empty title="No conversations yet" hint="Messages from connected channels appear here." />}
        </ul>
      </div>

      {/* messages */}
      {active ? (
        <div className={cn("flex min-h-0 flex-col", !mobileThread && "hidden lg:flex")}>
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <button className="lg:hidden" onClick={() => setMobileThread(false)} aria-label="Back"><ChevronLeft size={20} /></button>
            <Avatar name={active.contact.name} color="#ec4899" size={34} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{active.contact.name}</p>
              <p className="text-xs text-muted">{chipLabel(active.platform)}{active.contact.handle ? " · " + (active.platform === "INSTAGRAM" ? "@" : "") + active.contact.handle : ""}</p>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-bg/60 p-4">
            {active.messages.map((m) => (
              <div key={m.id} className={cn("flex", m.direction === "OUT" && "justify-end")}>
                <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2 text-sm", m.direction === "OUT" ? "rounded-br-md bg-accent text-accent-fg" : "rounded-bl-md border bg-surface")}>
                  {m.text}
                  <p className={cn("mt-1 text-[10px]", m.direction === "OUT" ? "text-accent-fg/70" : "text-muted")}>{timeAgo(m.sentAt)}{m.byAi && " · AI agent"}</p>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="border-t p-3">
            {err && <p className="mb-2 text-xs text-rose-600">{err}</p>}
            {!canReply && <p className="mb-2 text-xs text-muted">Replies to {chipLabel(active.platform)} are not sent from here yet. Answer in the {chipLabel(active.platform)} app; the message is tracked here.</p>}
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={2}
                placeholder={canReply ? "Write a reply…" : `Read-only: ${chipLabel(active.platform)} thread`}
                disabled={!canReply}
                className="min-h-[44px] flex-1 resize-none rounded-xl border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <div className="flex flex-col gap-1.5">
                <Button size="sm" onClick={suggest} disabled={!canReply || busy === "suggest"}><Sparkles size={14} /> {busy === "suggest" ? "Thinking…" : "Suggest"}</Button>
                <Button size="sm" variant="primary" onClick={send} disabled={!canReply || busy === "send" || !draft.trim()}><Send size={14} /> Send</Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden items-center justify-center lg:flex"><Empty title="Select a conversation" /></div>
      )}

      {/* contact panel */}
      {active && (
        <aside className="hidden overflow-y-auto border-l p-5 xl:block">
          <div className="text-center">
            <Avatar name={active.contact.name} color="#ec4899" size={60} />
            <p className="mt-3 font-semibold">{active.contact.name}</p>
            <p className="text-xs text-muted">{chipLabel(active.platform)}{active.contact.handle ? " · " + (active.platform === "INSTAGRAM" ? "@" : "") + active.contact.handle : ""}</p>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div><dt className="text-xs text-muted">Email</dt><dd>{active.contact.email ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted">Phone</dt><dd>{active.contact.phone ?? "—"}</dd></div>
          </dl>
          <div className="mt-5 border-t pt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Lead</p>
            {active.lead ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5"><ServiceBadge service={active.lead.service} /><StageBadge stage={active.lead.stage} /><ScoreBadge score={active.lead.score} /></div>
                <p className="text-xs text-muted">Owner: {active.lead.owner ?? "Unassigned"}</p>
                <Link href={`/leads?open=${active.lead.id}`} className="text-sm font-medium text-accent hover:underline">Open lead →</Link>
              </div>
            ) : (
              <Button className="w-full" onClick={makeLead} disabled={busy === "lead"}><UserPlus size={15} /> Create lead</Button>
            )}
            <Link href={`/contacts/${active.contact.id}`} className="mt-4 block text-sm font-medium text-accent hover:underline">View contact →</Link>
          </div>
        </aside>
      )}
    </Card>
  );
}
