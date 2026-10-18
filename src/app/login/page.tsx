"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Mic, Globe } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password, remember }),
    });
    if (res.ok) {
      router.replace("/");
      router.refresh();
    } else {
      setError((await res.json().catch(() => ({}))).error ?? `Sign in failed (server returned ${res.status})`);
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
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted">Sign in to your workspace</p>
          </div>
          <div>
            <Label>Email <span className="font-normal text-muted">(optional)</span></Label>
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" required autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
            Remember me for 30 days
          </label>
          {error && <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{error}</p>}
          <Button type="submit" variant="primary" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
