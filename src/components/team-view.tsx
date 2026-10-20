"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Bot, Pencil } from "lucide-react";
import { Avatar, Button, Card, CardHeader, Input, Label, Modal, Select, ServiceBadge } from "./ui";
import { SERVICES, SERVICE_META } from "@/lib/constants";
import { money } from "@/lib/utils";

type Member = { id: string; name: string; email: string; title: string | null; role: string; avatarColor: string; openLeads: number; won: number; revenue: number; services: string[] };
type Rule = { service: string; agent: string; userId: string | null };

export function TeamView({ members, rules, isAdmin, meId }: { members: Member[]; rules: Rule[]; isAdmin: boolean; meId: string }) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [f, setF] = React.useState({ name: "", email: "", password: "", title: "", role: "MEMBER" });
  const [editing, setEditing] = React.useState<Member | null>(null);
  const [ef, setEf] = React.useState({ name: "", email: "", title: "", role: "MEMBER", password: "" });
  const [editErr, setEditErr] = React.useState("");
  const maxOpen = Math.max(1, ...members.map((m) => m.openLeads));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    if (res.ok) {
      setAdding(false);
      setF({ name: "", email: "", password: "", title: "", role: "MEMBER" });
      router.refresh();
    } else setErr((await res.json().catch(() => ({}))).error ?? "Failed");
  }
  function startEdit(m: Member) {
    setEditing(m);
    setEditErr("");
    setEf({ name: m.name, email: m.email, title: m.title ?? "", role: m.role, password: "" });
  }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const body: Record<string, string | null> = { name: ef.name, email: ef.email, title: ef.title || null, role: ef.role };
    if (ef.password) body.password = ef.password;
    const res = await fetch(`/api/team/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      setEditing(null);
      router.refresh();
    } else setEditErr((await res.json().catch(() => ({}))).error ?? "Failed");
  }
  async function remove(m: Member) {
    if (!confirm(`Remove ${m.name}? Their leads become unassigned.`)) return;
    await fetch(`/api/team/${m.id}`, { method: "DELETE" });
    router.refresh();
  }
  async function setRule(service: string, value: string) {
    const body = value === "AI" ? { service, agent: "AI", userId: rules.find((r) => r.service === service)?.userId ?? null } : { service, agent: "HUMAN", userId: value || null };
    await fetch("/api/rules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        {isAdmin && <Button variant="primary" onClick={() => setAdding(true)}><Plus size={16} /> Add team member</Button>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {members.map((m) => (
          <Card key={m.id} className="animate-in p-5">
            <div className="flex items-start gap-3">
              <Avatar name={m.name} color={m.avatarColor} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{m.name} {m.id === meId && <span className="text-xs font-normal text-muted">(you)</span>}</p>
                <p className="truncate text-xs text-muted">{m.title ?? (m.role === "ADMIN" ? "Admin" : "Team member")} · {m.email}</p>
              </div>
              {isAdmin && (
                <button onClick={() => startEdit(m)} aria-label={`Edit ${m.name}`} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg"><Pencil size={15} /></button>
              )}
              {isAdmin && m.id !== meId && (
                <button onClick={() => remove(m)} aria-label={`Remove ${m.name}`} className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-600"><Trash2 size={15} /></button>
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[["Open", m.openLeads], ["Won", m.won], ["Revenue", money(m.revenue, true)]].map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-surface-2 py-2"><p className="text-sm font-semibold tabular-nums">{v}</p><p className="text-[11px] text-muted">{k}</p></div>
              ))}
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-muted"><span>Workload</span><span>{m.openLeads} open</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent" style={{ width: `${(m.openLeads / maxOpen) * 100}%` }} /></div>
            </div>
            <div className="mt-3 flex min-h-6 flex-wrap gap-1">{m.services.map((s) => <ServiceBadge key={s} service={s} />)}</div>
            {isAdmin && <Link href={`/team/${m.id}`} className="mt-3 inline-block text-xs font-medium text-accent hover:underline">View {m.id === meId ? "my" : "their"} workspace →</Link>}
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader title="Auto-assignment rules" subtitle="When Claude classifies a new lead, it is routed here automatically" />
        <div className="grid gap-4 px-5 pb-5 md:grid-cols-3">
          {SERVICES.map((s) => {
            const r = rules.find((x) => x.service === s);
            return (
              <div key={s} className="rounded-xl border p-4">
                <ServiceBadge service={s} />
                <p className="mt-2 text-xs text-muted">{SERVICE_META[s].label}</p>
                <Select className="mt-3" disabled={!isAdmin} value={r?.agent === "AI" ? "AI" : r?.userId ?? ""} onChange={(e) => setRule(s, e.target.value)}>
                  <option value="AI">🤖 AI agent</option>
                  <option value="">Nobody (round-robin)</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
                {r?.agent === "AI" && <p className="mt-2 flex items-center gap-1 text-xs text-violet-600"><Bot size={13} /> AI agent replies, then hands off to {members.find((m) => m.id === r.userId)?.name ?? "the least-busy member"}</p>}
              </div>
            );
          })}
        </div>
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add team member">
        <form onSubmit={add} className="space-y-3">
          <div><Label>Name</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>Email</Label><Input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><Label>Temporary password (min 8)</Label><Input required type="password" minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Job title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><Label>Role</Label><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="MEMBER">Team member</option><option value="ADMIN">Admin</option></Select></div>
          </div>
          {err && <p className="text-sm text-rose-600">{err}</p>}
          <div className="flex justify-end gap-2"><Button type="button" onClick={() => setAdding(false)}>Cancel</Button><Button type="submit" variant="primary">Add member</Button></div>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.name ?? ""}`}>
        <form onSubmit={saveEdit} className="space-y-3">
          <div><Label>Name</Label><Input required value={ef.name} onChange={(e) => setEf({ ...ef, name: e.target.value })} /></div>
          <div><Label>Email</Label><Input required type="email" value={ef.email} onChange={(e) => setEf({ ...ef, email: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Job title</Label><Input value={ef.title} onChange={(e) => setEf({ ...ef, title: e.target.value })} /></div>
            <div><Label>Role</Label><Select value={ef.role} disabled={editing?.id === meId} onChange={(e) => setEf({ ...ef, role: e.target.value })}><option value="MEMBER">Team member</option><option value="ADMIN">Admin</option></Select></div>
          </div>
          <div><Label>Reset password (leave blank to keep)</Label><Input type="password" minLength={8} autoComplete="new-password" value={ef.password} onChange={(e) => setEf({ ...ef, password: e.target.value })} /></div>
          {editErr && <p className="text-sm text-rose-600">{editErr}</p>}
          <div className="flex justify-end gap-2"><Button type="button" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" variant="primary">Save</Button></div>
        </form>
      </Modal>
    </>
  );
}
