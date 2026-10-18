"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { SERVICE_META, STAGE_META } from "@/lib/constants";

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[20px] border-0 bg-surface shadow-card ring-1 ring-black/[0.04] transition-shadow duration-300 hover:shadow-[0_8px_30px_-12px_rgb(0_0_0/0.12)] dark:bg-gradient-to-b dark:from-white/[0.05] dark:to-transparent dark:ring-white/[0.07]",
        className,
      )}
      {...p}
    />
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 p-5 pb-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};
export const Button = React.forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { className, variant = "secondary", size = "md", ...p },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background,transform,opacity] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        size === "sm" ? "h-8 px-3.5 text-[13px]" : "h-10 px-5 text-sm",
        variant === "primary" && "bg-[var(--cta)] text-[var(--cta-fg)] shadow-sm hover:opacity-90",
        variant === "secondary" && "border border-border bg-fg/[0.06] text-fg hover:bg-fg/10",
        variant === "ghost" && "text-accent hover:bg-accent/10",
        variant === "danger" && "bg-[#ff3b30] text-white hover:brightness-110",
        className,
      )}
      {...p}
    />
  );
});

const field =
  "h-10 w-full rounded-xl border-0 bg-surface-2 px-3.5 text-sm outline-none transition placeholder:text-muted focus:ring-2 focus:ring-accent/40";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...p }, ref) {
    return <input ref={ref} className={cn(field, className)} {...p} />;
  },
);
export function Select({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(field, "pr-8", className)} {...p} />;
}
export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, "h-auto min-h-20 py-2", className)} {...p} />;
}
export function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-muted">{children}</label>;
}

export function Avatar({ name, color = "#6366f1", size = 32 }: { name: string; color?: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function ServiceBadge({ service }: { service: string }) {
  const m = SERVICE_META[service] ?? SERVICE_META.UNASSIGNED;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", m.bg, m.text, m.ring)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.short}
    </span>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  const m = STAGE_META[stage];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-surface px-2 py-0.5 text-xs font-medium">
      <span className={cn("h-1.5 w-1.5 rounded-full", m?.dot)} />
      {m?.label ?? stage}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 75 ? "text-emerald-600 bg-emerald-500/10" : score >= 45 ? "text-amber-600 bg-amber-500/10" : "text-slate-500 bg-slate-500/10";
  return <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums", tone)}>{score}</span>;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  React.useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className={cn("slide-in absolute right-0 top-0 flex h-full w-full flex-col border-l bg-surface shadow-2xl", wide ? "max-w-xl" : "max-w-md")}>
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-2" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  React.useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="animate-in relative w-full max-w-md rounded-2xl border bg-surface p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-2" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-accent" : "bg-border")}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}
