"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardHeader, Input, Label, Toggle } from "./ui";

type S = { demoMode: boolean; autoAssign: boolean; aiAgent: boolean; claudeModel: string };
export type CodeState = { enabled: boolean; source: "settings" | "env" | null };

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function SettingsView({ settings, isAdmin, email, codeState }: { settings: S; isAdmin: boolean; email: string; codeState: CodeState | null }) {
  const router = useRouter();
  const [s, setS] = React.useState(settings);
  const [model, setModel] = React.useState(settings.claudeModel);
  const [err, setErr] = React.useState("");

  async function save(patch: Partial<S>) {
    setErr("");
    setS((cur) => ({ ...cur, ...patch }));
    const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!res.ok) {
      setS(settings);
      setErr((await res.json().catch(() => ({}))).error ?? "Could not save");
    } else router.refresh();
  }

  const [code, setCode] = React.useState("");
  const [cs, setCs] = React.useState(codeState);
  const [codeMsg, setCodeMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  async function saveCode(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings/team-code", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setCs(data);
      setCode("");
      setCodeMsg({ ok: true, text: "Team access code saved. Share it only with people you want on the team." });
    } else setCodeMsg({ ok: false, text: data.error ?? "Could not save the code" });
  }
  async function removeCode() {
    if (!confirm("Turn off team sign-up? Nobody will be able to create an account until you set a new code.")) return;
    const res = await fetch("/api/settings/team-code", { method: "DELETE" });
    if (res.ok) {
      setCs(await res.json());
      setCodeMsg({ ok: true, text: "Code removed." });
    }
  }

  const [pw, setPw] = React.useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwMsg, setPwMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) return setPwMsg({ ok: false, text: "New passwords don't match" });
    const res = await fetch("/api/account/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pw.currentPassword, newPassword: pw.newPassword }),
    });
    if (res.ok) {
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
      setPwMsg({ ok: true, text: "Password updated" });
    } else setPwMsg({ ok: false, text: (await res.json().catch(() => ({}))).error ?? "Could not change password" });
  }

  const rows: { key: "demoMode" | "autoAssign" | "aiAgent"; title: string; desc: string }[] = [
    { key: "demoMode", title: "Demo mode", desc: "Uses built-in heuristics instead of calling Claude, and never sends messages through Meta. Turn off once Meta and a Claude key are connected." },
    { key: "autoAssign", title: "Auto-assign new leads", desc: "Route every new lead to an AI agent or team member using the rules on the Team page." },
    { key: "aiAgent", title: "AI agent auto-replies", desc: "Leads assigned to the AI agent get an automatic DM reply. It hands the lead to a person when asked, when it's unsure, or after 4 replies. In demo mode replies are recorded but not sent." },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      {!isAdmin && <p className="rounded-xl border bg-surface-2 px-4 py-3 text-sm text-muted">Workspace settings are managed by the owner. You can change your own password below.</p>}
      {err && <p role="alert" className="text-sm text-rose-600">{err}</p>}
      {isAdmin && (
        <>
          <Card>
            <CardHeader title="Workspace" />
            <ul className="divide-y px-5 pb-2">
              {rows.map((r) => (
                <li key={r.key} className="flex items-center justify-between gap-6 py-4">
                  <div>
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{r.desc}</p>
                  </div>
                  <Toggle label={r.title} checked={s[r.key]} onChange={(v) => isAdmin && save({ [r.key]: v })} />
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Claude" subtitle="Model used to classify leads and draft replies" />
            <div className="px-5 pb-5">
              <Label>Model ID</Label>
              <Input value={model} disabled={!isAdmin} onChange={(e) => setModel(e.target.value)} onBlur={() => model !== s.claudeModel && model.trim() && save({ claudeModel: model.trim() })} />
              <p className="mt-2 text-xs text-muted">Default: claude-sonnet-5-5. Changes save when you click away.</p>
            </div>
          </Card>
        </>
      )}
      {isAdmin && (
        <Card>
          <CardHeader title="Team sign-up" subtitle="People who know this code can create their own team-member account on the sign-in page" />
          <form onSubmit={saveCode} className="space-y-3 px-5 pb-5">
            <p className="text-sm">
              Status:{" "}
              {cs?.enabled ? (
                <span className="font-medium text-emerald-600">open{cs.source === "env" ? " (code comes from TEAM_SIGNUP_CODE)" : ""}</span>
              ) : (
                <span className="font-medium text-amber-600">closed — no code set</span>
              )}
            </p>
            <div>
              <Label>{cs?.enabled ? "Replace the team access code" : "Set a team access code"} (min 8 characters)</Label>
              <div className="flex gap-2">
                <Input required minLength={8} maxLength={100} autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Only you should know this" />
                <Button type="button" onClick={() => setCode(randomCode())}>Generate</Button>
              </div>
              <p className="mt-2 text-xs text-muted">Stored hashed, so it can&apos;t be read back. Copy it before you save. Team members get their own password and can only see their own work. You stay the only admin.</p>
            </div>
            {codeMsg && <p role="status" className={codeMsg.ok ? "text-sm text-emerald-600" : "text-sm text-rose-600"}>{codeMsg.text}</p>}
            <div className="flex justify-end gap-2">
              {cs?.source === "settings" && <Button type="button" onClick={removeCode}>Turn off sign-up</Button>}
              <Button type="submit" variant="primary">Save code</Button>
            </div>
          </form>
        </Card>
      )}
      <Card>
        <CardHeader title="Your account" subtitle={`Signed in as ${email}`} />
        <form onSubmit={changePassword} className="space-y-3 px-5 pb-5">
          <div><Label>Current password</Label><Input required type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>New password (min 8)</Label><Input required type="password" minLength={8} autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></div>
            <div><Label>Confirm new password</Label><Input required type="password" minLength={8} autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
          </div>
          {pwMsg && <p role="status" className={pwMsg.ok ? "text-sm text-emerald-600" : "text-sm text-rose-600"}>{pwMsg.text}</p>}
          <div className="flex justify-end"><Button type="submit" variant="primary">Change password</Button></div>
        </form>
      </Card>
    </div>
  );
}
