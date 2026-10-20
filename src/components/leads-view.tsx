"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bot, KanbanSquare, LayoutList, Plus, Search, Sparkles } from "lucide-react";
import { Avatar, Button, Card, Empty, Input, Label, Modal, ScoreBadge, Select, ServiceBadge, Sheet, StageBadge, Textarea } from "./ui";
import { SERVICES, SERVICE_META, SOURCE_META, STAGES, STAGE_META } from "@/lib/constants";
import { cn, money, timeAgo } from "@/lib/utils";

type User = { id: string; name: string; avatarColor: string };
export type LeadRow = {
  id: string;
  title: string;
  source: string;
  service: string;
  stage: string;
  score: number;
  assignedAgent: string;
  assignedUserId: string | null;
  estimatedValue: number;
  createdAt: string;
  contact: { id: string; name: string; instagramHandle: string | null; email: string | null; phone: string | null; company: string | null };
};

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export function LeadsView({ leads, users, initialQuery, initialOpen, initialService, canBulk }: { leads: LeadRow[]; users: User[]; initialQuery: string; initialOpen: string | null; initialService: string; canBulk: boolean }) {
  const router = useRouter();
  const [view, setView] = React.useState<"table" | "board">("table");
  const [q, setQ] = React.useState(initialQuery);
  const [service, setService] = React.useState(initialService);
  const [stage, setStage] = React.useState("ALL");
  const [source, setSource] = React.useState("ALL");
  const [assignee, setAssignee] = React.useState("ALL");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [openId, setOpenId] = React.useState<string | null>(initialOpen);
  const [creating, setCreating] = React.useState(false);
  const [convertId, setConvertId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState("");

  const userById = React.useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (service !== "ALL" && l.service !== service) return false;
      if (stage !== "ALL" && l.stage !== stage) return false;
      if (source !== "ALL" && l.source !== source) return false;
      if (assignee === "AI" && l.assignedAgent !== "AI") return false;
      if (assignee === "NONE" && (l.assignedUserId || l.assignedAgent === "AI")) return false;
      if (assignee !== "ALL" && assignee !== "AI" && assignee !== "NONE" && l.assignedUserId !== assignee) return false;
      if (!needle) return true;
      return [l.title, l.contact.name, l.contact.instagramHandle, l.contact.email, l.contact.company].some((v) => v?.toLowerCase().includes(needle));
    });
  }, [leads, q, service, stage, source, assignee]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function bulk(patch: Record<string, unknown>, label: string) {
    try {
      await call("/api/leads/bulk", "POST", { ids: [...selected], ...patch });
      setSelected(new Set());
      flash(label);
      router.refresh();
    } catch (e) {
      flash((e as Error).message);
    }
  }

  async function moveStage(id: string, next: string) {
    if (next === "WON") return setConvertId(id);
    await call(`/api/leads/${id}`, "PATCH", { stage: next });
    router.refresh();
  }

  const allSelected = filtered.length > 0 && filtered.every((l) => selected.has(l.id));

  return (
    <>
      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input className="pl-9" placeholder="Search name, handle, email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select className="w-auto" value={service} onChange={(e) => setService(e.target.value)} aria-label="Service">
            <option value="ALL">All services</option>
            {[...SERVICES, "UNASSIGNED"].map((s) => <option key={s} value={s}>{SERVICE_META[s].short}</option>)}
          </Select>
          <Select className="w-auto" value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Stage">
            <option value="ALL">All stages</option>
            {STAGES.map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
          </Select>
          <Select className="w-auto" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
            <option value="ALL">All sources</option>
            {Object.entries(SOURCE_META).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select className="w-auto" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Assignee">
            <option value="ALL">Anyone</option>
            <option value="AI">AI agent</option>
            <option value="NONE">Unassigned</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <div className="inline-flex rounded-lg border p-0.5">
              {([["table", LayoutList], ["board", KanbanSquare]] as const).map(([v, Icon]) => (
                <button key={v} onClick={() => setView(v)} aria-label={`${v} view`} className={cn("rounded-md p-1.5", view === v ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}>
                  <Icon size={16} />
                </button>
              ))}
            </div>
            <Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} /> New lead</Button>
          </div>
        </div>
        {canBulk && selected.size > 0 && (
          <div className="animate-in mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-accent/10 px-3 py-2 text-sm">
            <span className="font-medium">{selected.size} selected</span>
            <span className="text-muted">Assign to:</span>
            {SERVICES.map((s) => (
              <Button key={s} size="sm" onClick={() => bulk({ service: s }, `Assigned ${selected.size} to ${SERVICE_META[s].short}`)}>
                {SERVICE_META[s].short}
              </Button>
            ))}
            <Button size="sm" onClick={() => bulk({ assignedAgent: "AI" }, "Handed to AI agent")}><Bot size={13} /> AI agent</Button>
            <Select className="h-8 w-auto text-xs" value="" onChange={(e) => e.target.value && bulk({ assignedUserId: e.target.value, assignedAgent: "HUMAN" }, "Assigned to team member")}>
              <option value="">Team member…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
            <button className="ml-auto text-xs text-muted hover:text-fg" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}
      </Card>

      {view === "table" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-surface-2/60 text-left text-xs text-muted">
                  <th className="w-10 px-4 py-3">
                    {canBulk && <input type="checkbox" aria-label="Select all" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(filtered.map((l) => l.id)))} />}
                  </th>
                  <th className="px-3 py-3 font-medium">Contact</th>
                  <th className="px-3 py-3 font-medium">Service</th>
                  <th className="px-3 py-3 font-medium">Stage</th>
                  <th className="px-3 py-3 font-medium">Score</th>
                  <th className="px-3 py-3 font-medium">Source</th>
                  <th className="px-3 py-3 font-medium">Assigned</th>
                  <th className="px-3 py-3 text-right font-medium">Value</th>
                  <th className="px-4 py-3 text-right font-medium">Captured</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const u = l.assignedUserId ? userById[l.assignedUserId] : null;
                  return (
                    <tr key={l.id} onClick={() => setOpenId(l.id)} className="cursor-pointer border-b last:border-0 hover:bg-surface-2/50">
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {canBulk && <input type="checkbox" aria-label={`Select ${l.contact.name}`} checked={selected.has(l.id)} onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })} />}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{l.contact.name}</p>
                        <p className="max-w-[18rem] truncate text-xs text-muted">{l.title}</p>
                      </td>
                      <td className="px-3 py-3"><ServiceBadge service={l.service} /></td>
                      <td className="px-3 py-3"><StageBadge stage={l.stage} /></td>
                      <td className="px-3 py-3"><ScoreBadge score={l.score} /></td>
                      <td className="px-3 py-3 text-xs text-muted">{SOURCE_META[l.source]}</td>
                      <td className="px-3 py-3">
                        {l.assignedAgent === "AI" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-600"><Bot size={13} /> AI agent</span>
                        ) : u ? (
                          <span className="flex items-center gap-2 text-xs"><Avatar name={u.name} color={u.avatarColor} size={22} />{u.name}</span>
                        ) : <span className="text-xs text-muted">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{l.estimatedValue ? money(l.estimatedValue) : "—"}</td>
                      <td className="px-4 py-3 text-right text-xs text-muted">{timeAgo(l.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <Empty title="No leads match these filters" hint="Try clearing a filter or search term." />}
        </Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((st) => {
            const col = filtered.filter((l) => l.stage === st);
            return (
              <div
                key={st}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { const id = e.dataTransfer.getData("text/plain"); if (id) moveStage(id, st); }}
                className="w-72 shrink-0 rounded-2xl border bg-surface-2/50 p-2"
              >
                <div className="flex items-center justify-between px-2 pb-2 pt-1 text-sm font-semibold">
                  <span className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", STAGE_META[st].dot)} />{STAGE_META[st].label}</span>
                  <span className="text-xs font-medium text-muted">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((l) => (
                    <div key={l.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)} onClick={() => setOpenId(l.id)} className="cursor-grab rounded-xl border bg-surface p-3 shadow-card transition hover:border-accent/50 active:cursor-grabbing">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{l.contact.name}</p>
                        <ScoreBadge score={l.score} />
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted">{l.title}</p>
                      <div className="mt-2.5 flex items-center justify-between">
                        <ServiceBadge service={l.service} />
                        <span className="text-xs tabular-nums text-muted">{l.estimatedValue ? money(l.estimatedValue) : ""}</span>
                      </div>
                    </div>
                  ))}
                  {col.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted">Drop leads here</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LeadDrawer key={openId ?? "closed"} id={openId} users={users} onClose={() => setOpenId(null)} onConvert={(id) => setConvertId(id)} onChanged={() => router.refresh()} />
      <NewLeadModal open={creating} onClose={() => setCreating(false)} onDone={() => { setCreating(false); flash("Lead created and classified by Claude"); router.refresh(); }} />
      <ConvertModal key={convertId ?? "none"} id={convertId} onClose={() => setConvertId(null)} lead={leads.find((l) => l.id === convertId)} onDone={() => { setConvertId(null); setOpenId(null); flash("Converted — revenue recorded"); router.refresh(); }} />
      {toast && <div role="status" className="animate-in fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-fg px-4 py-2.5 text-sm font-medium text-bg shadow-xl">{toast}</div>}
    </>
  );
}

type Detail = {
  id: string; title: string; service: string; stage: string; score: number; aiSummary: string | null; assignedAgent: string; assignedUserId: string | null; estimatedValue: number; source: string; createdAt: string;
  contact: { name: string; email: string | null; phone: string | null; instagramHandle: string | null; company: string | null };
  activities: { id: string; type: string; text: string; createdAt: string; user: { name: string } | null }[];
  deals: { id: string; amount: number }[];
};

function LeadDrawer({ id, users, onClose, onConvert, onChanged }: { id: string | null; users: User[]; onClose: () => void; onConvert: (id: string) => void; onChanged: () => void }) {
  const [d, setD] = React.useState<Detail | null>(null);
  const [note, setNote] = React.useState("");
  const [err, setErr] = React.useState("");

  const load = React.useCallback(async () => {
    if (!id) return;
    try {
      setD(await call(`/api/leads/${id}`, "GET"));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id]);
  React.useEffect(() => {
    if (!id) return;
    let live = true;
    call(`/api/leads/${id}`, "GET").then((r) => live && setD(r)).catch((e) => live && setErr((e as Error).message));
    return () => { live = false; };
  }, [id]);

  async function patch(p: Record<string, unknown>) {
    await call(`/api/leads/${id}`, "PATCH", p);
    await load();
    onChanged();
  }
  async function addNote() {
    if (!note.trim()) return;
    await call(`/api/leads/${id}/notes`, "POST", { text: note });
    setNote("");
    await load();
  }

  return (
    <Sheet open={!!id} onClose={onClose} title={d?.contact.name ?? "Lead"} wide>
      {err && <p className="p-5 text-sm text-rose-600">{err}</p>}
      {!d && !err && <div className="space-y-3 p-5">{[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-2" />)}</div>}
      {d && (
        <div className="space-y-6 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <ServiceBadge service={d.service} /> <StageBadge stage={d.stage} /> <ScoreBadge score={d.score} />
            <span className="text-xs text-muted">· {SOURCE_META[d.source]} · {timeAgo(d.createdAt)}</span>
          </div>
          {d.aiSummary && (
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-sm">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-violet-600"><Sparkles size={13} /> Claude summary</p>
              {d.aiSummary}
            </div>
          )}

          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[["Email", d.contact.email], ["Phone", d.contact.phone], ["Instagram", d.contact.instagramHandle && "@" + d.contact.instagramHandle], ["Company", d.contact.company]].map(([k, v]) => (
              <div key={k as string}><dt className="text-xs text-muted">{k}</dt><dd className="truncate font-medium">{v || "—"}</dd></div>
            ))}
          </dl>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Service</Label>
              <Select value={d.service} onChange={(e) => patch({ service: e.target.value })}>
                {[...SERVICES, "UNASSIGNED"].map((s) => <option key={s} value={s}>{SERVICE_META[s].short}</option>)}
              </Select>
            </div>
            <div>
              <Label>Stage</Label>
              <Select value={d.stage} onChange={(e) => (e.target.value === "WON" ? onConvert(d.id) : patch({ stage: e.target.value }))}>
                {STAGES.map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
              </Select>
            </div>
            <div>
              <Label>Handled by</Label>
              <Select value={d.assignedAgent} onChange={(e) => patch({ assignedAgent: e.target.value })}>
                <option value="HUMAN">Human</option>
                <option value="AI">AI agent</option>
              </Select>
            </div>
            <div>
              <Label>Team member</Label>
              <Select value={d.assignedUserId ?? ""} onChange={(e) => patch({ assignedUserId: e.target.value || null })}>
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </div>
          </div>

          {d.stage !== "WON" && d.service !== "UNASSIGNED" && (
            <Button variant="primary" className="w-full" onClick={() => onConvert(d.id)}>Mark as converted customer</Button>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold">Timeline</h3>
            <div className="mb-3 flex gap-2">
              <Input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} placeholder="Add a note…" />
              <Button onClick={addNote}>Add</Button>
            </div>
            <ol className="relative space-y-4 border-l pl-5">
              {d.activities.map((a) => (
                <li key={a.id} className="relative text-sm">
                  <span className={cn("absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface", a.type === "CONVERTED" ? "bg-emerald-500" : a.type === "AI" ? "bg-violet-500" : a.type === "NOTE" ? "bg-amber-500" : "bg-accent")} />
                  <p>{a.text}</p>
                  <p className="text-xs text-muted">{a.user?.name ? a.user.name + " · " : ""}{timeAgo(a.createdAt)}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function NewLeadModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = React.useState({ name: "", email: "", phone: "", instagramHandle: "", company: "", message: "" });
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await call("/api/leads", "POST", f);
      setF({ name: "", email: "", phone: "", instagramHandle: "", company: "", message: "" });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="New lead">
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Name *</Label><Input value={f.name} onChange={set("name")} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Email</Label><Input type="email" value={f.email} onChange={set("email")} /></div>
          <div><Label>Phone</Label><Input value={f.phone} onChange={set("phone")} /></div>
          <div><Label>Instagram</Label><Input value={f.instagramHandle} onChange={set("instagramHandle")} placeholder="@handle" /></div>
          <div><Label>Company</Label><Input value={f.company} onChange={set("company")} /></div>
        </div>
        <div><Label>What do they want? *</Label><Textarea value={f.message} onChange={set("message")} required placeholder="Claude uses this to pick the service and score the lead" /></div>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? "Classifying…" : "Create lead"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ConvertModal({ id, lead, onClose, onDone }: { id: string | null; lead?: LeadRow; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = React.useState(lead?.estimatedValue ? String(lead.estimatedValue) : "");
  const [err, setErr] = React.useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await call(`/api/leads/${id}/convert`, "POST", { amount: Number(amount) });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  return (
    <Modal open={!!id} onClose={onClose} title="Convert to customer">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted">Record the amount {lead?.contact.name ?? "this customer"} paid. It will count toward revenue and converted customers.</p>
        <div><Label>Amount paid (USD)</Label><Input type="number" min="1" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus /></div>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">Record revenue</Button>
        </div>
      </form>
    </Modal>
  );
}
