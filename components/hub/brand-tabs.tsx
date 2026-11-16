"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, Building2, CheckSquare, Ellipsis, Images, Inbox, Mail, Megaphone, Package, Pencil, PenLine, Settings, Share2, Users, Wallet, type LucideIcon } from "lucide-react";
import type { TabKey } from "@/lib/hub/tabs";
import { cn } from "@/lib/utils";

const DEFS: Record<TabKey, { label: string; short: string; icon: LucideIcon }> = {
  brand: { label: "Brand", short: "Brand", icon: Building2 },
  tasks: { label: "Tasks", short: "Tasks", icon: CheckSquare },
  inbox: { label: "Inbox", short: "Inbox", icon: Inbox },
  mail: { label: "Mail", short: "Mail", icon: Mail },
  social: { label: "Social Media", short: "Social", icon: Share2 },
  content: { label: "Content", short: "Content", icon: PenLine },
  ads: { label: "Ads", short: "Ads", icon: Megaphone },
  wiki: { label: "Wiki", short: "Wiki", icon: BookOpen },
  assets: { label: "Assets", short: "Assets", icon: Images },
  team: { label: "Team", short: "Team", icon: Users },
  finance: { label: "Finance", short: "Finance", icon: Wallet },
  products: { label: "Products", short: "Products", icon: Package },
  settings: { label: "Settings", short: "Settings", icon: Settings },
};

const itemCls = (active: boolean) =>
  cn("relative flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 text-caption font-semibold", active ? "text-ink-800" : "text-ink-500 hover:text-ink-800");

/**
 * The brand's sections, pinned to the bottom like a phone app.
 * Wide screen: every section the person may open. Phone: the four menus they chose, and "More" for the rest.
 */
export function BrandTabs({ slug, tabs, bar, more }: { slug: string; tabs: TabKey[]; bar: TabKey[]; more: TabKey[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);

  const hrefOf = (k: TabKey) => `/hub/b/${slug}/${k}`;
  const isActive = (k: TabKey) => pathname === hrefOf(k) || pathname.startsWith(`${hrefOf(k)}/`);
  const moreActive = more.some(isActive);

  const tab = (k: TabKey) => {
    const { label, short, icon: Icon } = DEFS[k];
    const active = isActive(k);
    return (
      <li key={k} className="min-w-0 flex-1">
        <Link href={hrefOf(k)} aria-label={label} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)} className={itemCls(active)}>
          {active && <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-brand-500" />}
          <Icon className={cn("size-6", active && "text-brand-500")} aria-hidden />
          <span className="lg:hidden">{short}</span>
          <span className="hidden lg:inline">{label}</span>
        </Link>
      </li>
    );
  };

  return (
    <nav
      aria-label="Brand sections"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-100 bg-paper-0 pb-[env(safe-area-inset-bottom)]"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          moreRef.current?.focus();
        }
      }}
    >
      {/* Wide screen: all sections */}
      <ul className="mx-auto hidden max-w-5xl sm:flex">{tabs.map(tab)}</ul>

      {/* Phone: four chosen menus and More */}
      <ul className="mx-auto flex max-w-xl sm:hidden">
        {bar.map(tab)}
        <li className="min-w-0 flex-1">
          <button ref={moreRef} type="button" aria-expanded={open} aria-controls="more-sections" onClick={() => setOpen((o) => !o)} className={itemCls(moreActive || open)}>
            {moreActive && <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-brand-500" />}
            <Ellipsis className={cn("size-6", moreActive && "text-brand-500")} aria-hidden />
            <span>More</span>
          </button>
        </li>
      </ul>

      {open && (
        <div className="sm:hidden">
          <button type="button" tabIndex={-1} aria-hidden onClick={() => setOpen(false)} className="fixed inset-0 -z-10 cursor-default" />
          <ul id="more-sections" aria-label="More sections" className="absolute bottom-full right-3 mb-2 w-64 rounded-card border border-hairline bg-paper-0 p-2 shadow-overlay">
            {more.map((k) => {
              const { label, icon: Icon } = DEFS[k];
              const active = isActive(k);
              return (
                <li key={k}>
                  <Link
                    href={hrefOf(k)}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn("flex min-h-12 items-center gap-3 rounded-field px-3 text-body font-semibold", active ? "bg-paper-100 text-ink-800" : "text-ink-600 hover:bg-paper-100")}
                  >
                    <Icon className={cn("size-5", active && "text-brand-500")} aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
            <li className={cn(more.length > 0 && "mt-1 border-t border-ink-100 pt-1")}>
              <Link href={`/hub/b/${slug}/settings/menu`} onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 rounded-field px-3 text-body font-semibold text-ink-600 hover:bg-paper-100">
                <Pencil className="size-5" aria-hidden />
                Edit bottom menu
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
