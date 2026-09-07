"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  KanbanSquare,
  CalendarDays,
  ListTodo,
  FileText,
  Blocks,
} from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { cn } from "@/lib/utils";

const clientNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/plan", label: "Master Plan", icon: KanbanSquare },
  { href: "/dashboard/builder", label: "Builder", icon: Blocks },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/reminders", label: "Reminders", icon: ListTodo },
  { href: "/dashboard/report", label: "Report", icon: FileText },
];

export function ClientShell({
  business,
  children,
}: {
  business: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const Inner = () => (
    <>
      <div className="px-2 py-1">
        <Link href="/dashboard">
          <Logo />
        </Link>
      </div>
      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {clientNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-coral/10 text-coral ring-1 ring-coral/25"
                  : "text-slate-400 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 border-t border-white/8 pt-4">
        <div className="rounded-xl bg-white/5 px-3.5 py-3">
          <p className="text-[0.68rem] uppercase tracking-wider text-slate-500">
            Bisnis
          </p>
          <p className="truncate text-sm font-semibold text-slate-200">
            {business}
          </p>
        </div>
        <a
          href="/dashboard/logout"
          className="mt-2 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-bad/10 hover:text-bad"
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </a>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-obsidian">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/8 bg-surface/60 p-4 lg:flex">
        <Inner />
      </aside>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/8 bg-obsidian/90 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/dashboard">
          <Logo />
        </Link>
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-200"
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-white/8 bg-surface p-4">
            <Inner />
          </aside>
        </div>
      )}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
