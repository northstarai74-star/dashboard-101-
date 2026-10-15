"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import {
  LayoutDashboard,
  Users,
  Inbox as InboxIcon,
  MessageSquareText,
  Contact2,
  UsersRound,
  PlugZap,
  Settings,
  Search,
  Moon,
  Sun,
  LogOut,
  Menu,
  Sparkles,
  Wand2,
  ChartColumn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";

type Counts = { inbox: number; comments: number };
type U = { name: string; email: string; role: string; avatarColor: string };

const NAV = [
  { group: "Workspace", items: [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/analytics", label: "Analytics", icon: ChartColumn },
    { href: "/leads", label: "Leads", icon: Users },
    { href: "/inbox", label: "Inbox", icon: InboxIcon, badge: "inbox" as const },
    { href: "/engagement", label: "Comments & Enquiries", icon: MessageSquareText, badge: "comments" as const },
  ]},
  { group: "CRM", items: [
    { href: "/contacts", label: "Contacts", icon: Contact2 },
    { href: "/team", label: "Team", icon: UsersRound },
    { href: "/studio", label: "Creative Studio", icon: Wand2 },
  ]},
  { group: "System", items: [
    { href: "/integrations", label: "Integrations", icon: PlugZap },
    { href: "/settings", label: "Settings", icon: Settings },
  ]},
];

export function Shell({ user, counts, demoMode, children }: { user: U; counts: Counts; demoMode: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [menu, setMenu] = React.useState(false);
  const [q, setQ] = React.useState("");


  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
          <Sparkles size={18} />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Vanita OS</p>
          <p className="text-[11px] text-muted">Business operating system</p>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV.map((g) => (
          <div key={g.group}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.group}</p>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
                const n = it.badge ? counts[it.badge] : 0;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                        active ? "bg-accent/10 text-accent" : "text-muted hover:bg-surface-2 hover:text-fg",
                      )}
                    >
                      <it.icon size={17} />
                      <span className="flex-1">{it.label}</span>
                      {n > 0 && <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-fg">{n}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      {demoMode && (
        <div className="m-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
          <p className="font-semibold text-amber-600 dark:text-amber-300">Demo mode</p>
          <p className="mt-0.5 text-muted">Showing sample data. Connect Meta in Integrations, then turn off demo mode in Settings.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-surface lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r bg-surface">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-surface/80 px-4 backdrop-blur lg:px-8">
          <button className="rounded-lg p-2 hover:bg-surface-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <form
            className="relative max-w-md flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/leads?q=${encodeURIComponent(q)}`);
            }}
          >
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search leads, contacts, handles…"
              className="h-10 w-full rounded-xl border bg-bg pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </form>
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={toggleTheme} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Toggle theme">
              <Moon size={18} className="dark:hidden" />
              <Sun size={18} className="hidden dark:block" />
            </button>
            <div className="relative">
              <button onClick={() => setMenu((v) => !v)} className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-surface-2">
                <Avatar name={user.name} color={user.avatarColor} size={32} />
                <span className="hidden text-left text-sm leading-tight sm:block">
                  <span className="block font-medium">{user.name}</span>
                  <span className="block text-[11px] text-muted">{user.role === "ADMIN" ? "Admin" : "Team member"}</span>
                </span>
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                  <div className="animate-in absolute right-0 z-20 mt-2 w-56 rounded-xl border bg-surface p-1.5 shadow-xl">
                    <p className="truncate px-3 py-2 text-xs text-muted">{user.email}</p>
                    <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
                      <LogOut size={15} /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
