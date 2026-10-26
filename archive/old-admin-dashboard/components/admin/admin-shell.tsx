"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, LogOut, ShieldAlert } from "lucide-react";
import { adminNav } from "@/lib/admin/config";
import { Logo } from "@/components/landing/logo";
import { cn } from "@/lib/utils";

export function AdminShell({
  email,
  role,
  openMode,
  children,
}: {
  email: string;
  role: string;
  openMode?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const NavLinks = () => (
    <nav className="flex flex-1 flex-col gap-1">
      {adminNav.map((item) => {
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
  );

  const SidebarInner = () => (
    <>
      <div className="px-2 py-1">
        <Link href="/admin">
          <Logo />
        </Link>
      </div>
      <div className="mt-8 flex flex-1 flex-col">
        <NavLinks />
        <div className="mt-4 border-t border-white/8 pt-4">
          <div className="rounded-xl bg-white/5 px-3.5 py-3">
            <p className="truncate text-sm font-medium text-slate-200">
              {email}
            </p>
            <p className="mt-0.5 font-mono text-[0.68rem] uppercase tracking-wider text-coral">
              {role}
            </p>
          </div>
          <a
            href="/admin/logout"
            className="mt-2 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-bad/10 hover:text-bad"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </a>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-obsidian">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/8 bg-surface/60 p-4 lg:flex">
        <SidebarInner />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/8 bg-obsidian/90 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/admin">
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

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-white/8 bg-surface p-4">
            <SidebarInner />
          </aside>
        </div>
      )}

      {/* Content */}
      <main className="lg:pl-64">
        {openMode && (
          <div className="flex items-center gap-2.5 border-b border-warn/20 bg-warn/10 px-5 py-2.5 text-xs text-warn sm:px-8">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              Mode terbuka — backend ini tidak terproteksi (siapa pun dengan URL
              bisa masuk). Untuk mengunci: set <code className="font-mono">ADMIN_OPEN=0</code> di Vercel lalu redeploy.
            </span>
          </div>
        )}
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
