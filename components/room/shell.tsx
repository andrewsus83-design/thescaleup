"use client";

// The Chat Room frame. The menu is ALWAYS on the left: a full sidebar from `lg`, and on phones a slim
// left rail (icon + label) — deliberately not a bottom bar. Tabs: Chat · Project · Builder · Assets · Setting.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, FlaskConical, FolderKanban, Hammer, Images, LogOut, MessageSquarePlus, MessagesSquare, Settings } from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { RECENT_THREADS } from "@/lib/room/mock";
import type { Role } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { RoomProvider, useRoom } from "./room-provider";
import { Segmented } from "./ui";

export const NAV = [
  { key: "chat", label: "Chat", path: "/chat", icon: MessagesSquare },
  { key: "projects", label: "Project", path: "/projects", icon: FolderKanban },
  { key: "builder", label: "Builder", path: "/builder", icon: Hammer },
  { key: "assets", label: "Assets", path: "/assets", icon: Images },
  { key: "settings", label: "Setting", path: "/settings", icon: Settings, adminOnly: true },
] as const;

export function RoomShell({
  basePath = "/room",
  email,
  role,
  children,
}: {
  basePath?: string;
  email: string;
  role: string;
  children: React.ReactNode;
}) {
  // owner/admin → admin; anything else (staff) → member
  const realRole: Role = role === "owner" || role === "admin" ? "admin" : "member";
  return (
    <RoomProvider basePath={basePath} realRole={realRole}>
      <Frame email={email} role={role}>
        {children}
      </Frame>
    </RoomProvider>
  );
}

function Frame({ email, role, children }: { email: string; role: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, href, basePath, canPreviewRole, setRole, open, setIntake, activeProject, toastText } = useRoom();

  const items = NAV.filter((n) => !("adminOnly" in n && n.adminOnly) || state.role === "admin");
  const isActive = (p: string) => pathname === `${basePath}${p}` || pathname.startsWith(`${basePath}${p}/`);
  const recent = activeProject ? RECENT_THREADS[activeProject.id] ?? [] : [];

  // "No project, no chat": a new chat always opens the project picker (the start screen).
  const newChat = () => {
    setIntake(null);
    open(null);
    router.push(href("/chat"));
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-obsidian text-mist">
      <aside
        aria-label="Chat Room menu"
        className="flex w-[68px] shrink-0 flex-col border-r border-white/8 bg-surface/60 py-3 lg:w-64 lg:p-4"
      >
        <div className="flex justify-center lg:justify-start lg:px-1">
          <Link href={href("/chat")} aria-label="Chat Room home" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70">
            <span className="lg:hidden">
              <Logo showWordmark={false} />
            </span>
            <span className="hidden lg:inline-flex">
              <Logo />
            </span>
          </Link>
        </div>

        <button
          type="button"
          onClick={newChat}
          aria-label="New chat"
          className="mx-2 mt-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-coral text-sm font-semibold text-ink transition-colors hover:bg-coral-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70 lg:mx-0 lg:h-10"
        >
          <MessageSquarePlus className="h-5 w-5" aria-hidden />
          <span className="hidden lg:inline">New chat</span>
        </button>

        <nav aria-label="Chat Room tabs" className="mt-4 flex flex-col gap-1 px-1.5 lg:px-0">
          {items.map((n) => {
            const Icon = n.icon;
            const active = isActive(n.path);
            return (
              <Link
                key={n.key}
                href={href(n.path)}
                title={n.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70 lg:flex-row lg:gap-3 lg:px-3.5 lg:py-2.5 lg:text-sm",
                  active ? "bg-coral/10 text-coral ring-1 ring-coral/25" : "text-slate-300 hover:bg-white/5 hover:text-mist",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* the project's recent threads sit under the menu (desktop) */}
        <div className="mt-6 hidden min-h-0 flex-1 flex-col lg:flex">
          <p className="px-3.5 font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">
            Recent{activeProject ? ` · ${activeProject.name}` : ""}
          </p>
          <ul className="mt-2 space-y-1 overflow-y-auto">
            {recent.length ? (
              recent.map((t) => (
                <li key={t}>
                  <Link href={href("/chat")} className="block truncate rounded-lg px-3.5 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70">
                    {t}
                  </Link>
                </li>
              ))
            ) : (
              <li className="px-3.5 py-2 text-sm text-slate-400">{activeProject ? "No threads yet." : "Pick a project to see its threads."}</li>
            )}
          </ul>
        </div>

        <div className="mt-auto flex flex-col items-center gap-1 px-1.5 pt-3 lg:mt-3 lg:items-stretch lg:border-t lg:border-white/8 lg:px-0">
          <div className="hidden rounded-xl bg-white/5 px-3.5 py-3 lg:block">
            <p className="truncate text-sm font-medium text-slate-200">{email}</p>
            <p className="mt-0.5 font-mono text-[0.68rem] uppercase tracking-wider text-coral">{role}</p>
          </div>
          <a
            href="/admin"
            title="Back to admin"
            className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium text-slate-300 hover:bg-white/5 hover:text-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70 lg:flex-row lg:gap-3 lg:px-3.5 lg:text-sm"
          >
            <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden />
            Admin
          </a>
          <a
            href="/admin/logout"
            title="Keluar"
            className="hidden items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-300 hover:bg-bad/10 hover:text-bad focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70 lg:flex"
          >
            <LogOut className="h-5 w-5" aria-hidden />
            Keluar
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-warn/20 bg-warn/10 px-4 py-2 text-xs text-warn">
          <span className="flex items-center gap-2">
            <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Prototype — mock data and canned replies. Nothing is saved or sent.
          </span>
          {canPreviewRole && (
            <span className="flex items-center gap-2">
              Preview as
              <Segmented
                label="Preview as"
                value={state.role}
                onChange={setRole}
                options={[
                  { value: "admin", label: "Admin" },
                  { value: "member", label: "Member" },
                ]}
              />
            </span>
          )}
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        {toastText && <div className="pointer-events-auto max-w-md rounded-xl border border-white/10 bg-card-2 px-4 py-2.5 text-sm text-mist shadow-xl">{toastText}</div>}
      </div>
    </div>
  );
}
