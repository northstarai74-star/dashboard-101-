"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Mic, Globe } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";

type Mode = "signin" | "join";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("signin");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setPassword("");
    setConfirm("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "join" && password !== confirm) return setError("The two passwords don't match");
    setBusy(true);
    const res = await fetch(mode === "join" ? "/api/auth/signup" : "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "join" ? { name: name.trim(), email: email.trim(), password, code: code.trim() } : { email: email.trim(), password, remember }),
    });
    if (res.ok) {
      router.replace("/");
      router.refresh();
    } else {
      setError((await res.json().catch(() => ({}))).error ?? `${mode === "join" ? "Sign up" : "Sign in"} failed (server returned ${res.status})`);
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-black/10 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur"><Sparkles size={20} /></div>
          <span className="text-lg font-semibold">North Star AI OS</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">Every lead. Every channel. One place.</h2>
          <p className="mt-4 text-white/80">Capture Instagram DMs, comments and Meta lead ads, let Claude qualify them, and track every dollar of revenue.</p>
          <ul className="mt-8 space-y-3 text-sm">
            {[[Mic, "AI Voice Receptionist"], [Globe, "Web Development"]].map(([Icon, t]) => {
              const I = Icon as typeof Mic;
              return (
                <li key={t as string} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15"><I size={16} /></span>
                  {t as string}
                </li>
              );
            })}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">Personal business workspace</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="animate-in w-full max-w-sm space-y-5">
          <div className="grid grid-cols-2 gap-1 rounded-xl border bg-surface-2 p-1 text-sm font-medium" role="tablist">
            {([["signin", "Sign in"], ["join", "Join as team member"]] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={mode === m ? "rounded-lg bg-surface px-3 py-2 shadow-sm" : "rounded-lg px-3 py-2 text-muted hover:text-fg"}
              >
                {label}
              </button>
            ))}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{mode === "join" ? "Create your team account" : "Welcome back"}</h1>
            <p className="mt-1 text-sm text-muted">
              {mode === "join" ? "Ask the owner for the team access code. You'll get your own workspace and password." : "Sign in to your workspace"}
            </p>
          </div>
          {mode === "join" && (
            <div>
              <Label>Full name</Label>
              <Input required autoFocus autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
          )}
          <div>
            <Label>Email {mode === "signin" && <span className="font-normal text-muted">(the owner can leave this blank)</span>}</Label>
            <Input type="email" required={mode === "join"} autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <Label>{mode === "join" ? "Choose a password (min 8)" : "Password"}</Label>
            <Input
              type="password"
              required
              minLength={mode === "join" ? 8 : undefined}
              autoFocus={mode === "signin"}
              autoComplete={mode === "join" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {mode === "join" && (
            <>
              <div>
                <Label>Confirm password</Label>
                <Input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <Label>Team access code</Label>
                <Input type="password" required autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} placeholder="From the owner" />
              </div>
            </>
          )}
          {mode === "signin" && (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
              Remember me for 30 days
            </label>
          )}
          {error && <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{error}</p>}
          <Button type="submit" variant="primary" className="w-full" disabled={busy}>
            {busy ? (mode === "join" ? "Creating account…" : "Signing in…") : mode === "join" ? "Create account" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
