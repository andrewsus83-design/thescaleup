"use client";

// The Chat Room frame (BRAND.md §5). The menu is ALWAYS on the left — deliberately not a bottom tab bar: a 240px sidebar from `lg`,
// and below that a 72px rail (icon + short label). Tabs: Chat · Project · Builder · Assets · Setting.
// The Room paints its own paper surface over the whole viewport; the root layout's dark body sits behind it.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, FolderKanban, Hammer, Images, LogOut, MessageSquarePlus, MessagesSquare, Settings } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { RECENT_THREADS } from "@/lib/room/mock";
import type { Role } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { RoomProvider, useRoom } from "./room-provider";
import { Dot, Segmented, motion } from "./ui";

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

/** A menu row: icon over a short label on the rail, dot + label in the sidebar. Active = Paper fill (+ Orange dot in the sidebar). */
const menuItem = (active: boolean) =>
  cn(
    "flex h-14 w-full flex-col items-center justify-center gap-1 rounded-nav text-[11px] font-semibold leading-none",
    "lg:h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-[15px]",
    motion,
    active ? "bg-paper-100 text-ink-800" : "text-ink-500 hover:bg-paper-100 hover:text-ink-800",
  );

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
    <div className="room-app fixed inset-0 z-10 flex overflow-hidden bg-paper-100 font-text text-body text-ink-800 antialiased">
      <aside aria-label="Chat Room menu" className="flex w-rail shrink-0 flex-col bg-paper-0 py-4 lg:w-sidebar lg:px-4 lg:py-6">
        <Link href={href("/chat")} aria-label="Chat Room home" className="mx-auto flex h-11 min-w-11 items-center justify-center rounded-nav lg:mx-0 lg:justify-start lg:px-3">
          <Logo variant="primary" size={40} className="lg:hidden" />
          <Logo variant="lockup" size={28} className="hidden lg:inline-flex" />
        </Link>

        <button
          type="button"
          onClick={newChat}
          aria-label="New chat"
          className={cn(
            "mx-auto mt-6 inline-flex size-11 items-center justify-center gap-2 rounded-full bg-brand-500 text-[15px] font-semibold leading-none text-ink-800 hover:bg-brand-600 active:bg-brand-700 active:text-paper-0 lg:mx-0 lg:w-full lg:px-6",
            motion,
          )}
        >
          <MessageSquarePlus className="size-5" aria-hidden />
          <span className="hidden lg:inline">New chat</span>
        </button>

        <nav aria-label="Chat Room tabs" className="mt-6 flex flex-col gap-1 px-2 lg:px-0">
          {items.map((n) => {
            const Icon = n.icon;
            const active = isActive(n.path);
            return (
              <Link key={n.key} href={href(n.path)} aria-current={active ? "page" : undefined} className={menuItem(active)}>
                <Icon className={cn("size-5 shrink-0 lg:hidden", active && "text-brand-700")} aria-hidden />
                <Dot className={cn("hidden lg:block", active ? "bg-brand-500" : "bg-ink-200")} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* the project's recent threads sit under the menu (desktop) */}
        <div className="mt-8 hidden min-h-0 flex-1 flex-col lg:flex">
          <p className="label-caps truncate px-3 text-ink-500">Recent{activeProject ? ` · ${activeProject.name}` : ""}</p>
          <ul className="-mx-1 mt-2 space-y-1 overflow-y-auto px-1 py-1">
            {recent.length ? (
              recent.map((t) => (
                <li key={t}>
                  <Link href={href("/chat")} className={cn("flex h-11 items-center rounded-nav px-3 text-[14px] text-ink-800 hover:bg-paper-100", motion)}>
                    <span className="truncate">{t}</span>
                  </Link>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-[14px] text-ink-500">{activeProject ? "No threads yet." : "Pick a project to see its threads."}</li>
            )}
          </ul>
        </div>

        <div className="mt-auto flex flex-col gap-1 px-2 pt-4 lg:mt-4 lg:px-0">
          <div className="mb-2 hidden rounded-field bg-paper-100 px-4 py-3 lg:block">
            <p className="truncate text-[14px] font-semibold">{email}</p>
            <p className="label-caps mt-1 text-brand-700">{role}</p>
          </div>
          <a href="/admin" className={menuItem(false)}>
            <ArrowLeft className="size-5 shrink-0" aria-hidden />
            Admin
          </a>
          <a href="/admin/logout" className={cn(menuItem(false), "hidden lg:flex")}>
            <LogOut className="size-5 shrink-0" aria-hidden />
            Keluar
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-warning-bg px-5 py-2 text-[13px] leading-[1.5] sm:px-8 lg:px-12">
          <span className="flex items-center gap-3">
            <Dot className="bg-warning" />
            Prototype — mock data and canned replies. Nothing is saved or sent.
          </span>
          {canPreviewRole && (
            <span className="flex items-center gap-3">
              Preview as
              <Segmented
                label="Preview as"
                size="sm"
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

      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-5">
        {toastText && <div className="pointer-events-auto max-w-md rounded-bubble bg-ink-800 px-6 py-3 text-[14px] font-medium text-paper-100 shadow-menu">{toastText}</div>}
      </div>
    </div>
  );
}
