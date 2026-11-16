"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Images, Inbox, Settings, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { path: "tasks", label: "Tasks", short: "Tasks", icon: CheckSquare },
  { path: "inbox", label: "Inbox", short: "Inbox", icon: Inbox },
  { path: "social", label: "Social Media", short: "Social", icon: Share2 },
  { path: "assets", label: "Assets", short: "Assets", icon: Images },
  { path: "settings", label: "Settings", short: "Settings", icon: Settings },
] as const;

/** The brand's five sections, pinned to the bottom of the screen like a phone app. */
export function BrandTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Brand sections" className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-100 bg-paper-0 pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {TABS.map(({ path, label, short, icon: Icon }) => {
          const href = `/hub/b/${slug}/${path}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={path}>
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-caption font-semibold",
                  active ? "text-ink-800" : "text-ink-500 hover:text-ink-800",
                )}
              >
                {active && <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-brand-500" />}
                <Icon className={cn("size-6", active && "text-brand-500")} aria-hidden />
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
