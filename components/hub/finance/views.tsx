// What Finance looks like. These take plain data and draw it, with no reading or saving of their own, so a page can hand them
// real numbers and a preview can hand them made-up ones. NO "use client": server pages render them.
//
// The look follows the brand home: Paper page, white raised cards, an Ink panel for the one number that matters, and the menu's own
// colour (`--acc-*`, green for Finance) for icons, tiles and bars. Colour is never the only signal: every state also has words.

import Link from "next/link";
import {
  AppWindow,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Car,
  ChevronRight,
  CircleDollarSign,
  FileText,
  HandCoins,
  Landmark,
  Megaphone,
  Package,
  ReceiptText,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Bar, Chip } from "@/components/brand/primitives";
import { btnCls, cardCls, groupTitleCls, sectionTitleCls } from "@/components/brand/styles";
import { cn } from "@/lib/utils";
import { fmtMoney } from "@/lib/hub/money";
import { fmtDay, monthLabel } from "@/lib/hub/tasks/dates";
import type { Entry, MonthSum, Owed, PlanRow, PlanTotals } from "@/lib/hub/finance/model";

// ---------------------------------------------------------------------------------------------- small pieces
const ICONS: [RegExp, LucideIcon][] = [
  [/salar|payroll|wage|gaji/i, Users],
  [/rent|office|sewa/i, Building2],
  [/market|ads|iklan|promo/i, Megaphone],
  [/software|tool|subscription|langganan/i, AppWindow],
  [/suppl|stock|inventory|bahan/i, Package],
  [/transport|travel|fuel|bensin/i, Car],
  [/tax|pajak/i, Landmark],
  [/commission|komisi/i, HandCoins],
  [/sale|service|income|penjualan|jasa/i, TrendingUp],
];
/** An icon for a category by its name. Only decoration: the name is always written beside it. */
export function categoryIcon(category: string): LucideIcon {
  return ICONS.find(([re]) => re.test(category))?.[1] ?? CircleDollarSign;
}

/** The round icon in the menu's colour. `quiet` is the grey one for money out, so money in stands out. */
export function IconBubble({ icon: Icon, quiet, className }: { icon: LucideIcon; quiet?: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-full", quiet ? "bg-paper-100 text-ink-600" : "bg-(--acc-tint) text-(--acc-ink)", className)}>
      <Icon className="size-5" />
    </span>
  );
}

/** A white raised card with a title row: the title, an optional line under it and an optional link on the right. */
export function Panel({ id, title, hint, action, className, children }: { id: string; title: string; hint?: React.ReactNode; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={cn(cardCls(true), "flex flex-col", className)}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={id} className={groupTitleCls}>
            {title}
          </h2>
          {hint && <p className="mt-1 text-small font-normal text-ink-500">{hint}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export const moreLinkCls = "hit-44 inline-flex items-center gap-1 text-small font-semibold text-brand-700 underline underline-offset-4";

// ---------------------------------------------------------------------------------------------- the month, on an Ink panel
/**
 * The one number that matters this month: what is left over (or how much it is short), with money in and money out under it.
 * With a plan, a meter shows how much of the planned spending is used next to how far the month has run.
 */
export function MonthHero({ month, sum, plan, progress, currency, className }: { month: string; sum: MonthSum; plan: PlanTotals | null; progress: number; currency: string; className?: string }) {
  const short = sum.net < 0;
  const spent = plan && plan.out > 0 ? Math.round((sum.out / plan.out) * 100) : null;
  return (
    <section aria-label={`${monthLabel(month)} so far`} className={cn("flex flex-col justify-between gap-8 rounded-card bg-ink-800 p-6 text-paper-100 shadow-raised sm:p-8", className)}>
      <div>
        <p className="label-caps text-(--acc-tint)">{monthLabel(month)} so far</p>
        <p className="mt-4 text-small font-normal text-ink-300">{short ? "Short by" : "Left over"}</p>
        <p className={cn("mt-1 break-words font-title text-h2 font-extrabold sm:text-h1", short && "text-brand-300")}>{fmtMoney(Math.abs(sum.net), currency)}</p>
      </div>
      <div className="space-y-6">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {(
            [
              ["Money in", sum.in, ArrowDownLeft],
              ["Money out", sum.out, ArrowUpRight],
            ] as const
          ).map(([label, value, Icon]) => (
            <div key={label} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-field bg-ink-700 px-4 py-3 sm:block sm:p-4">
              <dt className="flex items-center gap-2 text-caption text-ink-300">
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </dt>
              <dd className="whitespace-nowrap font-title text-h4 text-paper-0 sm:mt-2">{fmtMoney(value, currency)}</dd>
            </div>
          ))}
        </dl>
        {spent !== null && plan && (
          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-caption text-ink-300">
              <span>
                <span className="font-semibold text-paper-0">{spent}%</span> of the planned spending used
              </span>
              <span>The month is {progress}% through</span>
            </div>
            <Bar value={Math.min(spent, 100)} tone={spent > 100 ? "bad" : spent > progress + 10 ? "warn" : "brand"} label={`${spent}% of the planned spending used`} onDark />
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------- what clients owe
export function OwedCard({ owed, currency, href, more }: { owed: Owed; currency: string; href: string; more?: boolean }) {
  return (
    <Panel id="fin-owed" title="Clients owe you" className="justify-between">
      <div>
        <p className="break-words font-title text-h2 text-ink-800">{fmtMoney(owed.unpaid, currency)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {owed.unpaidCount === 0 ? <Chip tone="ok">Nothing waiting</Chip> : <Chip tone="warn">{owed.unpaidCount} not paid</Chip>}
          {owed.overdueCount > 0 && <Chip tone="bad">{owed.overdueCount} late</Chip>}
        </div>
        {owed.overdueCount > 0 && <p className="mt-3 text-small font-normal text-ink-600">{fmtMoney(owed.overdue, currency)} is past its due date.</p>}
        {more && <p className="mt-3 text-caption text-ink-500">Only the first 500 unpaid invoices are counted.</p>}
      </div>
      <Link href={href} className={btnCls("secondary", "sm", "mt-6 self-start")}>
        Open invoices
      </Link>
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------- quick actions
export type Shortcut = { key: string; label: string; hint: string; href: string; icon: LucideIcon };

/** Big tiles in the menu's colour for the things done most. Two across on a phone, four on a desktop. */
export function Shortcuts({ items }: { items: Shortcut[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Shortcuts">
      {items.map(({ key, label, hint, href, icon: Icon }) => (
        <li key={key}>
          <Link href={href} className="hit-44 flex h-full min-h-28 flex-col justify-between gap-4 rounded-bubble bg-(--acc-tint) p-5 transition-transform active:scale-[0.98] motion-reduce:transition-none">
            <span aria-hidden className="inline-flex size-11 items-center justify-center rounded-full bg-paper-0/70 text-(--acc-ink)">
              <Icon className="size-5" />
            </span>
            <span>
              <span className="block font-title text-body font-bold text-(--acc-ink)">{label}</span>
              <span className="block text-caption text-ink-600">{hint}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export const FINANCE_ICONS = { out: ArrowUpRight, in: ArrowDownLeft, invoice: FileText, plan: Target, report: ReceiptText } as const;

// ---------------------------------------------------------------------------------------------- plan against actual
const STATE_TONE = { ok: "ok", near: "warn", over: "bad", unplanned: "neutral" } as const;

/** One category against its plan: icon, name, "used of planned", a meter, and the state in words. */
export function PlanMeter({ row, currency }: { row: PlanRow; currency: string }) {
  const out = row.kind === "out";
  // For money in, passing the plan is good news; for money out it is the warning.
  const tone = row.state === "unplanned" ? "neutral" : out ? STATE_TONE[row.state] : "ok";
  const word =
    row.state === "unplanned"
      ? "Not in the plan"
      : out
        ? row.state === "over"
          ? `Over by ${fmtMoney(-row.left, currency)}`
          : row.state === "near"
            ? `${row.pct}% used`
            : `${fmtMoney(row.left, currency)} left`
        : row.state === "over"
          ? `Plan reached, ${fmtMoney(-row.left, currency)} more`
          : `${fmtMoney(row.left, currency)} to go`;
  return (
    <li className="flex items-start gap-4 py-4">
      <IconBubble icon={categoryIcon(row.category)} quiet={out} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-4">
          <p className="min-w-0 break-words text-body font-semibold text-ink-800">{row.category}</p>
          <p className="shrink-0 whitespace-nowrap font-mono text-small font-medium text-ink-800">{fmtMoney(row.actual, currency)}</p>
        </div>
        {row.plan > 0 && (
          <div className="mt-2">
            <Bar value={Math.min(row.pct, 100)} tone={tone === "neutral" ? "neutral" : tone} label={`${row.category}: ${row.pct}% of the plan`} />
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 text-caption">
          <p className={cn(out && row.state === "over" ? "font-semibold text-danger-ink" : "text-ink-500")}>{word}</p>
          {row.plan > 0 && <p className="whitespace-nowrap text-ink-500">of {fmtMoney(row.plan, currency)} planned</p>}
        </div>
      </div>
    </li>
  );
}

export function PlanMeters({ rows, currency, limit }: { rows: PlanRow[]; currency: string; limit?: number }) {
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <>
      <ul className="-my-4 divide-y divide-ink-100">
        {shown.map((r) => (
          <PlanMeter key={`${r.kind}:${r.category}`} row={r} currency={currency} />
        ))}
      </ul>
      {limit && rows.length > limit ? <p className="mt-4 text-caption text-ink-500">And {rows.length - limit} more in the plan.</p> : null}
    </>
  );
}

// ---------------------------------------------------------------------------------------------- months as bars
/**
 * Money in and money out for a run of months, as pairs of bars. The bars are a picture for sighted people; the same numbers follow
 * in a table for screen readers, and each bar's title gives its amount.
 */
export function MonthBars({ series, currency }: { series: MonthSum[]; currency: string }) {
  const top = Math.max(1, ...series.map((s) => Math.max(s.in, s.out)));
  const h = (n: number) => `${n === 0 ? 0 : Math.max(3, Math.round((n / top) * 100))}%`;
  return (
    <div className="flex flex-1 flex-col">
      <div aria-hidden className="flex min-h-44 flex-1 items-end gap-2 sm:gap-4">
        {series.map((s) => (
          <div key={s.month} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2">
            <div className="flex h-full items-end justify-center gap-1">
              <span title={`In ${fmtMoney(s.in, currency)}`} className="w-full max-w-8 rounded-t-nav bg-(--acc-fill)" style={{ height: h(s.in) }} />
              <span title={`Out ${fmtMoney(s.out, currency)}`} className="w-full max-w-8 rounded-t-nav bg-ink-300" style={{ height: h(s.out) }} />
            </div>
            <span className="truncate text-center font-mono text-micro text-ink-500">{monthLabel(s.month).slice(0, 3)}</span>
          </div>
        ))}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-caption text-ink-600" aria-hidden>
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-(--acc-fill)" />
          Money in
        </li>
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-ink-300" />
          Money out
        </li>
      </ul>
      <table className="sr-only">
        <caption>Money in and money out by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Money in</th>
            <th scope="col">Money out</th>
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.month}>
              <th scope="row">{monthLabel(s.month)}</th>
              <td>{fmtMoney(s.in, currency)}</td>
              <td>{fmtMoney(s.out, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- entries
/** One amount in a list: icon, category, date and note, and the amount with its sign. Money in is green and says "+". */
export function EntryRow({ entry, currency, children }: { entry: Entry; currency: string; children?: React.ReactNode }) {
  const isIn = entry.kind === "in";
  return (
    <li className="flex items-center gap-4 py-3">
      <IconBubble icon={entry.invoiceId ? FileText : categoryIcon(entry.category)} quiet={!isIn} />
      <div className="min-w-0 flex-1">
        <p className="break-words text-body font-semibold text-ink-800">{entry.category}</p>
        <p className="line-clamp-2 text-caption text-ink-500">
          {fmtDay(entry.day)}
          {entry.note ? `, ${entry.note}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className={cn("whitespace-nowrap font-mono text-caption font-medium sm:text-small", isIn ? "text-success-ink" : "text-ink-800")}>
          <span className="sr-only">{isIn ? "Money in" : "Money out"} </span>
          {isIn ? "+" : "−"}
          {fmtMoney(entry.amount, currency)}
        </p>
        {children}
      </div>
    </li>
  );
}

/** A link styled as the arrow at the end of a card title. */
export function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={moreLinkCls}>
      {children}
      <ChevronRight className="size-4" aria-hidden />
    </Link>
  );
}

export { sectionTitleCls };
