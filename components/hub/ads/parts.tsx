import Link from "next/link";
import { Megaphone } from "lucide-react";
import { Btn, Chip, EmptyState } from "@/components/brand/primitives";
import { btnCls, labelCls, pillCls, segItem, segWrap, tileCls } from "@/components/brand/styles";
import { compactField } from "@/components/hub/tasks/parts";
import type { Problem } from "@/lib/hub/ads/zernio";
import { PRESETS, SORTS, SORT_LABEL, STATUS_LABEL, STATUS_TONE, count, money, pct, platformLabel, type AdRow, type Filters, type Range, type Total } from "@/lib/hub/ads/model";
import { dayIn, fmtDay } from "@/lib/hub/tasks/dates";
import { cn } from "@/lib/utils";

export const adsBase = (slug: string) => `/hub/b/${slug}/ads`;

type Params = { range: Range; platform?: string; min?: number; max?: number; sort?: string };

/** An Ads address that keeps the chosen days and platform (and, when given, the spend limits and sort). */
export function adsHref(base: string, p: Params): string {
  const q = new URLSearchParams();
  if (p.range.preset) q.set("r", p.range.preset);
  else {
    q.set("from", p.range.from);
    q.set("to", p.range.to);
  }
  if (p.platform) q.set("p", p.platform);
  if (p.min !== undefined) q.set("min", String(p.min));
  if (p.max !== undefined) q.set("max", String(p.max));
  if (p.sort) q.set("sort", p.sort);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

const SECTIONS = [
  { id: "active", label: "Active", path: "" },
  { id: "history", label: "History", path: "/history" },
  { id: "ideas", label: "Suggestions", path: "/ideas" },
] as const;

export function AdsNav({ slug, active, range, platform }: { slug: string; active: "active" | "history" | "ideas"; range: Range; platform?: string }) {
  return (
    <nav aria-label="Ads sections" className={`${segWrap} mb-6`}>
      {SECTIONS.map((s) => (
        <Link key={s.id} href={adsHref(`${adsBase(slug)}${s.path}`, { range, platform })} aria-current={active === s.id ? "page" : undefined} className={segItem(active === s.id)}>
          {s.label}
        </Link>
      ))}
    </nav>
  );
}

/** Days, platform, spend and sort. Everything is in the address, so a view can be bookmarked or shared. `full` adds the spend and sort fields. */
export function FilterBar({ base, range, filters, platforms, today, full }: { base: string; range: Range; filters: Filters; platforms: string[]; today: string; full: boolean }) {
  const keep = { platform: filters.platform, min: filters.min, max: filters.max, sort: filters.sort };
  return (
    <section aria-label="Filters" className="mb-6 space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Days">
        {PRESETS.map((p) => (
          <Link key={p.id} href={adsHref(base, { ...keep, range: { from: "", to: "", preset: p.id } })} aria-pressed={range.preset === p.id} className={pillCls(range.preset === p.id)}>
            {p.label}
          </Link>
        ))}
      </div>
      <form method="get" action={base} className="flex flex-wrap items-end gap-3">
        {filters.platform && <input type="hidden" name="p" value={filters.platform} />}
        <label className="block">
          <span className={labelCls}>From</span>
          <input type="date" name="from" defaultValue={range.from} max={today} className={cn(compactField, "w-44")} />
        </label>
        <label className="block">
          <span className={labelCls}>To</span>
          <input type="date" name="to" defaultValue={range.to} max={today} className={cn(compactField, "w-44")} />
        </label>
        {full && (
          <>
            <label className="block">
              <span className={labelCls}>Spent at least</span>
              <input name="min" inputMode="decimal" defaultValue={filters.min ?? ""} placeholder="0" className={cn(compactField, "w-32")} />
            </label>
            <label className="block">
              <span className={labelCls}>Spent at most</span>
              <input name="max" inputMode="decimal" defaultValue={filters.max ?? ""} placeholder="No limit" className={cn(compactField, "w-32")} />
            </label>
            <label className="block">
              <span className={labelCls}>Sort by</span>
              <select name="sort" defaultValue={filters.sort} className={cn(compactField, "w-44")}>
                {SORTS.map((s) => (
                  <option key={s} value={s}>
                    {SORT_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <Btn type="submit" variant="secondary" size="sm">
          Apply
        </Btn>
      </form>
      {platforms.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Platform">
          <Link href={adsHref(base, { ...keep, platform: undefined, range })} aria-pressed={!filters.platform} className={pillCls(!filters.platform)}>
            All platforms
          </Link>
          {platforms.map((p) => (
            <Link key={p} href={adsHref(base, { ...keep, platform: p, range })} aria-pressed={filters.platform === p} className={pillCls(filters.platform === p)}>
              {platformLabel(p)}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption text-ink-500">{label}</dt>
      <dd className="mt-0.5 font-mono text-body font-medium text-ink-800">{value}</dd>
    </div>
  );
}

/** The sums of what is listed, one row per currency. */
export function TotalsStrip({ totals }: { totals: Total[] }) {
  if (totals.length === 0) return null;
  return (
    <div className={`${tileCls} mb-6 space-y-4`}>
      {totals.map((t) => (
        <dl key={t.currency ?? "none"} className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label={`Spent${t.currency ? ` (${t.currency})` : ""}`} value={money(t.spend, t.currency)} />
          <Stat label="Ads" value={count(t.ads)} />
          <Stat label="Shown" value={count(t.impressions)} />
          <Stat label="Clicks" value={count(t.clicks)} />
          <Stat label="Click rate" value={pct(t.ctr)} />
          <Stat label="Cost per click" value={money(t.cpc, t.currency)} />
        </dl>
      ))}
    </div>
  );
}

function flight(a: AdRow, tz: string): string | null {
  const d = (iso: string | null) => (iso && !Number.isNaN(Date.parse(iso)) ? fmtDay(dayIn(tz, iso)) : null);
  const s = d(a.startsAt);
  const e = d(a.endsAt);
  if (s && e) return `Runs ${s} to ${e}`;
  if (s) return `Started ${s}`;
  const c = d(a.createdAt);
  return c ? `Created ${c}` : null;
}

export function AdList({ ads, tz }: { ads: AdRow[]; tz: string }) {
  return (
    <ul className="space-y-3">
      {ads.map((a) => {
        const when = flight(a, tz);
        return (
          <li key={a.id} className="rounded-field bg-paper-0 p-5 shadow-raised">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-body font-semibold text-ink-800">{a.name}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 text-small text-ink-500">
                  <span>{platformLabel(a.platform)}</span>
                  {a.campaign && a.campaign !== a.name && <span className="break-words">{a.campaign}</span>}
                  {a.kind && <span>{a.kind === "boost" ? "Boosted post" : "Ad"}</span>}
                </p>
              </div>
              <Chip tone={STATUS_TONE[a.status]}>{a.status === "other" && a.rawStatus ? a.rawStatus.toLowerCase() : STATUS_LABEL[a.status]}</Chip>
            </div>
            {a.reason && <p className="mt-2 text-small text-ink-800">{a.reason}</p>}
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Spent" value={money(a.spend, a.currency)} />
              <Stat label="Shown" value={count(a.impressions)} />
              <Stat label="Clicks" value={count(a.clicks)} />
              <Stat label="Click rate" value={pct(a.ctr)} />
              <Stat label="Cost per click" value={money(a.cpc, a.currency)} />
              {a.results !== null && <Stat label="Results" value={count(a.results)} />}
            </dl>
            {when && <p className="mt-3 text-caption text-ink-500">{when}</p>}
          </li>
        );
      })}
    </ul>
  );
}

/** Nothing to show because Zernio could not be read: say why, and what to do. */
export function ProblemNotice({ slug, problem, canSetup }: { slug: string; problem: Problem; canSetup: boolean }) {
  const setup = problem.kind === "no-key" || problem.kind === "auth";
  return (
    <EmptyState icon={<Megaphone className="size-6" aria-hidden />} title={problem.kind === "no-key" ? "Connect a social account to see ads" : "Ads could not be loaded"} hint={problem.kind === "no-key" ? (canSetup ? `${problem.message} Ads shows up here.` : "The founder connects the brand's accounts. Ask them to.") : problem.message}>
      {setup && canSetup && (
        <Link href={`/hub/b/${slug}/settings/social`} className={btnCls("primary", "md")}>
          Open Social media connections
        </Link>
      )}
    </EmptyState>
  );
}
