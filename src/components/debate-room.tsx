"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardHeader, Empty, Textarea } from "./ui";
import { cn } from "@/lib/utils";

export type DebateRow = {
  id: string;
  question: string;
  mode: string;
  verdict: string;
  actions: string[];
  advisors: { name: string; advice: string }[];
  createdAt: string;
};

export function DebateRoom({ initial }: { initial: DebateRow[] }) {
  const router = useRouter();
  const [question, setQuestion] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/debates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "The council could not analyse this");
      setQuestion("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="mt-4 p-5">
        <CardHeader title="Describe the issue" subtitle="The council analyses your current position from the business data, then saves the result below." />
        <form onSubmit={analyze} className="mt-4 space-y-3">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="e.g. Our Instagram DMs are high but few turn into paying clients. Should we fix follow-up or spend more on ads?"
            aria-label="Describe the issue"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted">{question.length}/1000</span>
            <Button type="submit" disabled={busy || question.trim().length < 10}>
              {busy ? "Analysing…" : "Analyze current position"}
            </Button>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
      </Card>

      <Card className="mt-4 p-5">
        <CardHeader title="Debate results" subtitle={`${initial.length} saved`} />
        {initial.length === 0 ? (
          <Empty title="No results yet" hint="Describe an issue above and analyse it to save the first debate." />
        ) : (
          <ul className="mt-4 space-y-4">
            {initial.map((d) => (
              <DebateItem key={d.id} debate={d} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function DebateItem({ debate }: { debate: DebateRow }) {
  const when = new Date(debate.createdAt).toLocaleString();
  return (
    <li className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{debate.question}</p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold",
            debate.mode === "live" ? "bg-emerald-500/10 text-emerald-600" : "bg-accent/10 text-accent",
          )}
        >
          {debate.mode === "live" ? "Live council" : "Rule-based"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">{when}</p>
      <p className="mt-3 text-sm">
        <span className="font-semibold">Verdict: </span>
        {debate.verdict}
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        {debate.actions.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-muted">Seat by seat ({debate.advisors.length})</summary>
        <ul className="mt-2 space-y-2 text-sm">
          {debate.advisors.map((a) => (
            <li key={a.name}>
              <span className="font-semibold">{a.name}: </span>
              {a.advice}
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}
