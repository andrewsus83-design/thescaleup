"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Images, Inbox, Settings, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { path: "tasks", label: "Tasks", icon: CheckSquare },
  { path: "inbox", label: "Inbox", icon: Inbox },
  { path: "social", label: "Social Media", icon: Share2 },
  { path: "assets", label: "Assets", icon: Images },
  { path: "settings", label: "Settings", icon: Settings },
] as const;

export function BrandTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Brand sections" className="border-b border-ink-100 bg-paper-0">
      <ul className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-3 sm:px-6">
        {TABS.map(({ path, label, icon: Icon }) => {
          const href = `/hub/b/${slug}/${path}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={path}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-12 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-small font-semibold",
                  active ? "border-brand-500 text-ink-800" : "border-transparent text-ink-500 hover:text-ink-800",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
