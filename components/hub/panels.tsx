// Page building blocks shared by every menu: the two-column page that uses the whole frame, the Ink panel for the one thing that
// matters, and number tiles. They draw plain data and read nothing themselves. NO "use client": server pages render them.
//
// The colour comes from the menu the page is in (`--acc-*`, set by AccentScope), so the same piece is teal in Team and green in Finance.

import { cn } from "@/lib/utils";

export { IconBubble, MoreLink, moreLinkCls, Panel } from "@/components/hub/finance/views";

/**
 * A page that uses the whole frame: a wide main column and a side column. On a phone they stack; from a laptop up the side column
 * sits on the right and stays in view. Every grid here names its phone columns, so a wide child cannot stretch the page.
 */
export function Split({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("grid grid-cols-1 items-start gap-4 lg:grid-cols-3", className)}>{children}</div>;
}
export function SplitMain({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("min-w-0 space-y-4 lg:order-1 lg:col-span-2", className)}>{children}</div>;
}
/** `first` puts the side column above the main one on a phone (for the thing a person came to do). It is always on the right on a laptop. */
export function SplitSide({ first, className, children }: { first?: boolean; className?: string; children: React.ReactNode }) {
  return <div className={cn("min-w-0 space-y-4 lg:sticky lg:top-6 lg:order-2", first ? "order-first" : "order-last", className)}>{children}</div>;
}

/** The dark panel for the one thing that matters on a page. `label` is the small line at the top, in the menu's colour. */
export function InkPanel({ label, aside, className, children }: { label: string; aside?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className={cn("rounded-card bg-ink-800 p-6 text-paper-100 shadow-raised", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label-caps text-(--acc-tint)">{label}</p>
        {aside}
      </div>
      {children}
    </section>
  );
}

export type InkStatItem = { label: string; value: React.ReactNode; warn?: boolean };

/** The big number of an Ink panel, with the words that say what it is right after it: "7 days left". */
export function InkFigure({ label, value, warn }: InkStatItem) {
  return (
    <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className={cn("break-words font-title text-h1 font-extrabold leading-none", warn && "text-brand-300")}>{value}</span>
      <span className="text-body font-normal text-ink-300">{label}</span>
    </p>
  );
}

/** Smaller numbers on an Ink panel. One row per number on a phone, side by side from a tablet up. */
export function InkStats({ items, className }: { items: InkStatItem[]; className?: string }) {
  return (
    <dl className={cn("mt-6 grid grid-cols-1 gap-3", items.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3", className)}>
      {items.map((s) => (
        <div key={s.label} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-field bg-ink-700 px-4 py-3 sm:block lg:flex xl:block">
          <dt className="text-caption text-ink-300">{s.label}</dt>
          <dd className={cn("whitespace-nowrap font-title text-h4 sm:mt-1 lg:mt-0 xl:mt-1", s.warn ? "text-brand-300" : "text-paper-0")}>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Numbers on a white card, each in its own tinted tile in the menu's colour. */
export function StatTiles({ items, className }: { items: { label: string; value: React.ReactNode; hint?: string; warn?: boolean; /** Takes a whole row. */ wide?: boolean }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-3", items.length >= 4 ? "lg:grid-cols-4" : "sm:grid-cols-3", className)}>
      {items.map((s) => (
        <div key={s.label} className={cn("min-w-0 rounded-bubble bg-(--acc-tint) p-4", s.wide && "col-span-full")}>
          <dt className="text-caption text-ink-600">{s.label}</dt>
          <dd className={cn("mt-1 break-words font-title text-h3", s.warn ? "text-danger-ink" : "text-(--acc-ink)")}>{s.value}</dd>
          {s.hint && <dd className="mt-1 text-caption text-ink-600">{s.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Rows inside a Panel, separated by hairlines. The first and last row sit flush with the panel's padding. */
export const panelRowsCls = "-my-3 divide-y divide-ink-100";
