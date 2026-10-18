"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, Plug, RefreshCw, Trash2 } from "lucide-react";
import { Button, Card, Input, Label, Modal } from "./ui";
import { cn, timeAgo } from "@/lib/utils";
import { GROUPS, type GroupId } from "@/lib/connections-groups";
import type { ChannelState } from "@/lib/connections";

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

const STATUS = {
  CONNECTED: { label: "Connected", cls: "bg-emerald-500/10 text-emerald-600" },
  ERROR: { label: "Check failed", cls: "bg-rose-500/10 text-rose-600" },
  NOT_CONNECTED: { label: "Not connected", cls: "bg-slate-500/10 text-slate-500" },
} as const;

export function ConnectionsView({ channels, isAdmin }: { channels: ChannelState[]; isAdmin: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<ChannelState | null>(null);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState("");
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = React.useState<GroupId | "ALL">("ALL");
  const visible = tab === "ALL" ? channels : channels.filter((c) => c.group === tab);

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 6000);
  };

  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id);
    try {
      await fn();
    } catch (e) {
      flash(false, (e as Error).message);
    }
    setBusy("");
  }

  function openEditor(c: ChannelState) {
    // Secret fields start blank: the stored value is never sent back to the browser.
    setValues(Object.fromEntries(c.fields.map((f) => [f.key, f.secret ? "" : (c.config[f.key] ?? "")])));
    setEditing(c);
  }

  const saveAndTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const id = editing.id;
    run(id, async () => {
      await api(`/api/connections/${id}`, "PUT", values);
      const r = await api(`/api/connections/${id}/test`, "POST");
      flash(r.ok, r.detail);
      setEditing(null);
      router.refresh();
    });
  };

  const test = (c: ChannelState) =>
    run(c.id, async () => {
      const r = await api(`/api/connections/${c.id}/test`, "POST");
      flash(r.ok, r.detail);
      router.refresh();
    });

  const disconnect = (c: ChannelState) => {
    if (!confirm(`Disconnect ${c.name}? The saved credentials will be deleted.`)) return;
    run(c.id, async () => {
      await api(`/api/connections/${c.id}`, "DELETE");
      flash(true, `${c.name} disconnected`);
      router.refresh();
    });
  };

  const connectedCount = channels.filter((c) => c.status === "CONNECTED").length;

  return (
    <div className="space-y-6">
      {msg && (
        <div role="status" className={cn("animate-in rounded-xl border px-4 py-3 text-sm", msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300")}>
          {msg.text}
        </div>
      )}
      {!isAdmin && <p className="rounded-xl border bg-surface-2 px-4 py-3 text-sm text-muted">Only admins can change connections. You can view their status here.</p>}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="lg:sticky lg:top-6 lg:w-56 lg:shrink-0">
        <nav aria-label="Connection groups" className="rounded-xl border bg-surface-2 p-2">
          <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted">Groups</p>
          <ul role="tablist" aria-orientation="vertical" className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
            {[{ id: "ALL" as const, label: "All" }, ...GROUPS].map((g) => {
              const count = g.id === "ALL" ? channels.length : channels.filter((c) => c.group === g.id).length;
              const selected = tab === g.id;
              return (
                <li key={g.id}>
                  <button
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setTab(g.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition",
                      selected ? "bg-surface text-fg shadow-sm" : "text-muted hover:bg-surface hover:text-fg",
                    )}
                  >
                    {g.label}
                    <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-xs text-muted">{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 border-t px-3 pt-3 text-xs text-muted">{connectedCount} of {channels.length} connected</p>
        </nav>
      </aside>

      <div role="tabpanel" className="grid min-w-0 flex-1 gap-4 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
        {visible.map((c) => {
          const st = STATUS[c.status];
          const configured = c.fields.length > 0 && c.fields.some((f) => (f.secret ? c.hasSecret[f.key] : !!c.config[f.key]));
          return (
            <Card key={c.id} className="flex flex-col">
              <div className="flex items-start gap-3 p-5">
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white", c.color)}>
                  <Plug size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate font-semibold">{c.name}</h3>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", st.cls)}>{st.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{c.blurb}</p>
                </div>
              </div>

              <div className="flex-1 space-y-1 px-5 pb-4 text-xs">
                {c.accountLabel && <p className="truncate font-medium text-fg">{c.accountLabel}</p>}
                {c.lastCheckedAt && <p className="text-muted">Last checked {timeAgo(c.lastCheckedAt)}</p>}
                {c.lastError && <p className="truncate text-rose-600" title={c.lastError}>{c.lastError}</p>}
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3">
                {c.managedBy === "meta" ? (
                  <Link href="/integrations" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                    Set up on Integrations <ArrowUpRight size={14} />
                  </Link>
                ) : (
                  <>
                    {isAdmin && (
                      <Button size="sm" variant="primary" onClick={() => openEditor(c)}>{configured ? "Edit" : "Connect"}</Button>
                    )}
                    {isAdmin && configured && (
                      <Button size="sm" disabled={busy === c.id} onClick={() => test(c)}>
                        <RefreshCw size={14} className={busy === c.id ? "animate-spin" : ""} /> Test
                      </Button>
                    )}
                    {isAdmin && configured && (
                      <button onClick={() => disconnect(c)} aria-label={`Disconnect ${c.name}`} className="ml-auto rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-600">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Connect ${editing?.name ?? ""}`}>
        {editing && (
          <form onSubmit={saveAndTest} className="space-y-3">
            {editing.fields.map((f) => {
              const saved = f.secret && editing.hasSecret[f.key];
              return (
                <div key={f.key}>
                  <Label>
                    {f.label}
                    {f.required && <span className="text-rose-500"> *</span>}
                    {saved && <span className="text-emerald-600"> · saved</span>}
                  </Label>
                  <Input
                    type={f.secret ? "password" : "text"}
                    autoComplete="off"
                    placeholder={saved ? "•••••••• (leave blank to keep)" : f.placeholder ?? ""}
                    required={f.required && !saved}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  />
                  {f.help && <p className="mt-1 text-xs text-muted">{f.help}</p>}
                </div>
              );
            })}
            <p className="text-xs text-muted">Secrets are encrypted at rest and never shown again. Saving runs a live check against the provider.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={busy === editing.id}>
                <Check size={14} /> Save and test
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
