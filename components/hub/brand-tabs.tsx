"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Ellipsis, Pencil } from "lucide-react";
import type { TabKey } from "@/lib/hub/tabs";
import { cn } from "@/lib/utils";
import { MENU } from "./menus";

/** The scrolling box the page lives in: the nearest ancestor that scrolls, else the window. */
function scroller(from: HTMLElement | null): HTMLElement | Window {
  for (let el = from?.parentElement ?? null; el && el !== document.body; el = el.parentElement) {
    const o = getComputedStyle(el).overflowY;
    if (o === "auto" || o === "scroll") return el;
  }
  return window;
}

/**
 * True while the person is scrolling down, so the bar can slide away and give the page the whole screen; scrolling up, or being near the
 * top, brings it back. It is keyed to the address, so opening another page always starts with the bar showing.
 */
function useHideOnScroll(ref: React.RefObject<HTMLElement | null>, path: string): boolean {
  const [state, setState] = useState({ hidden: false, path });
  useEffect(() => {
    const target = scroller(ref.current);
    const top = () => (target instanceof Window ? window.scrollY : target.scrollTop);
    let last = top();
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = top();
        const d = y - last;
        if (y <= 24) setState({ hidden: false, path });
        else if (d > 10) setState({ hidden: true, path });
        else if (d < -10) setState({ hidden: false, path });
        if (Math.abs(d) > 10 || y <= 24) last = y;
      });
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref, path]);
  return state.hidden && state.path === path;
}

const itemCls = (active: boolean) =>
  cn(
    "relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 font-semibold leading-none transition-colors duration-150 ease-out focus-visible:shadow-focus focus-visible:outline-none",
    // Active: Scale Orange with Ink (5.3:1; white on orange is never used). Inactive: a smaller, lighter grey label and an even lighter icon, so the open menu stands out. The label is the lightest grey
    // that still reads on white (4.5:1); the icon may go lighter (3:1 is enough for a graphic).
    active ? "bg-brand-500 text-caption text-ink-800" : "text-micro text-ink-500 hover:bg-paper-100 hover:text-ink-800 [&>svg]:text-ink-400 hover:[&>svg]:text-ink-800",
  );

/**
 * The brand's menus, as a rounded bar floating at the bottom. Phone: the four menus the person chose and "More". From tablet width up:
 * every menu they may open (names are shown from a laptop width; a tablet shows icons). The bar slides away while scrolling down.
 */
export function BrandTabs({ slug, tabs, bar, more }: { slug: string; tabs: TabKey[]; bar: TabKey[]; more: TabKey[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const scrolledAway = useHideOnScroll(navRef, pathname);
  const hidden = scrolledAway && !open && !focused;

  const hrefOf = (k: TabKey) => (k === "home" ? `/hub/b/${slug}` : `/hub/b/${slug}/${k}`);
  const isActive = (k: TabKey) => (k === "home" ? pathname === hrefOf(k) : pathname === hrefOf(k) || pathname.startsWith(`${hrefOf(k)}/`));
  const moreActive = more.some(isActive);

  const tab = (k: TabKey, wide: boolean) => {
    const { label, short, icon: Icon } = MENU[k];
    const active = isActive(k);
    return (
      <li key={k} className="flex min-w-0 flex-1">
        <Link href={hrefOf(k)} aria-label={label} title={label} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)} className={itemCls(active)}>
          <Icon className="size-6 shrink-0" aria-hidden />
          {wide ? <span className="hidden max-w-full truncate lg:block">{short}</span> : <span className="max-w-full truncate">{short}</span>}
        </Link>
      </li>
    );
  };

  return (
    <nav
      ref={navRef}
      aria-label="Brand sections"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          moreRef.current?.focus();
        }
      }}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] transition-transform duration-200 ease-out motion-reduce:transition-none",
        hidden && "translate-y-[calc(100%+1rem)]",
      )}
    >
      <div className="pointer-events-auto relative w-full max-w-md rounded-full border border-hairline bg-paper-0 p-2 shadow-overlay md:max-w-6xl">
        {/* Tablet and up: every menu */}
        <ul className="hidden gap-1 md:flex">{tabs.map((k) => tab(k, true))}</ul>

        {/* Phone: four chosen menus and More */}
        <ul className="flex gap-1 md:hidden">
          {bar.map((k) => tab(k, false))}
          <li className="flex min-w-0 flex-1">
            <button ref={moreRef} type="button" aria-expanded={open} aria-controls="more-sections" onClick={() => setOpen((o) => !o)} className={itemCls(moreActive || open)}>
              <Ellipsis className="size-6" aria-hidden />
              <span>More</span>
            </button>
          </li>
        </ul>

        {open && (
          <div className="md:hidden">
            <button type="button" tabIndex={-1} aria-hidden onClick={() => setOpen(false)} className="fixed inset-0 -z-10 cursor-default" />
            <ul id="more-sections" aria-label="More sections" className="absolute right-0 bottom-full mb-3 w-72 rounded-card border border-hairline bg-paper-0 p-2 shadow-overlay">
              {more.map((k) => {
                const { label, icon: Icon } = MENU[k];
                const active = isActive(k);
                return (
                  <li key={k} data-acc={k}>
                    <Link href={hrefOf(k)} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)} className={cn("flex min-h-12 items-center gap-3 rounded-full px-2 pr-4 text-body font-semibold focus-visible:shadow-focus focus-visible:outline-none", active ? "bg-brand-500 text-ink-800" : "text-ink-800 hover:bg-paper-100")}>
                      <span className="inline-flex size-9 items-center justify-center rounded-full bg-(--acc-tint) text-(--acc-ink)">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      {label}
                    </Link>
                  </li>
                );
              })}
              <li className={cn(more.length > 0 && "mt-1 border-t border-hairline pt-1")}>
                <Link href={`/hub/b/${slug}/settings/menu`} onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 rounded-full px-2 pr-4 text-body font-semibold text-ink-500 hover:bg-paper-100 hover:text-ink-800 focus-visible:shadow-focus focus-visible:outline-none">
                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-paper-100">
                    <Pencil className="size-5" aria-hidden />
                  </span>
                  Edit bottom menu
                </Link>
              </li>
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
}
