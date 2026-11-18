import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Share2 } from "lucide-react";
import { Btn, Chip, EmptyState } from "@/components/brand/primitives";
import { btnCls, labelCls, pillCls, tileCls } from "@/components/brand/styles";
import { compactField } from "@/components/hub/tasks/parts";
import type { Problem } from "@/lib/hub/ads/zernio";
import { PRESETS, count, pct, platformLabel, type PostRow, type Range } from "@/lib/hub/ads/model";
import { change, engagement, engagementRate, fillDays, type Daily, type Note, type Window } from "@/lib/hub/social/model";
import { fmtDay } from "@/lib/hub/tasks/dates";
import { cn } from "@/lib/utils";

export const socialBase = (slug: string) => `/hub/b/${slug}/social`;

/** A Social address that keeps the chosen days and platform, so a view can be bookmarked or shared. */
export function socialHref(base: string, range: Range, platform?: string): string {
  const q = new URLSearchParams();
  if (range.preset) q.set("r", range.preset);
  else {
    q.set("from", range.from);
    q.set("to", range.to);
  }
  if (platform) q.set("p", platform);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export function RangeBar({ base, range, platform, platforms, today }: { base: string; range: Range; platform?: string; platforms: string[]; today: string }) {
  return (
    <section aria-label="Filters" className="mb-6 space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Days">
        {PRESETS.map((p) => (
          <Link key={p.id} href={socialHref(base, { from: "", to: "", preset: p.id }, platform)} aria-pressed={range.preset === p.id} className={pillCls(range.preset === p.id)}>
            {p.label}
          </Link>
        ))}
      </div>
      <form method="get" action={base} className="flex flex-wrap items-end gap-3">
        {platform && <input type="hidden" name="p" value={platform} />}
        <label className="block">
          <span className={labelCls}>From</span>
          <input type="date" name="from" defaultValue={range.from} max={today} className={cn(compactField, "w-44")} />
        </label>
        <label className="block">
          <span className={labelCls}>To</span>
          <input type="date" name="to" defaultValue={range.to} max={today} className={cn(compactField, "w-44")} />
        </label>
        <Btn type="submit" variant="secondary" size="sm">
          Apply
        </Btn>
      </form>
      {platforms.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Platform">
          <Link href={socialHref(base, range)} aria-pressed={!platform} className={pillCls(!platform)}>
            All platforms
          </Link>
          {platforms.map((p) => (
            <Link key={p} href={socialHref(base, range, p)} aria-pressed={platform === p} className={pillCls(platform === p)}>
              {platformLabel(p)}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function Delta({ cur, prev }: { cur: number; prev: number | undefined }) {
  const c = prev === undefined ? null : change(cur, prev);
  if (c === null) return null;
  const up = c >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("ml-2 inline-flex items-center gap-0.5 text-caption font-semibold", up ? "text-success-ink" : "text-danger")}>
      <Icon className="size-3.5" aria-hidden />
      {Math.abs(c).toLocaleString("en-US", { maximumFractionDigits: 0 })}%<span className="sr-only"> {up ? "more" : "less"} than the days before</span>
    </span>
  );
}

function Stat({ label, value, delta }: { label: string; value: string; delta?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-caption text-ink-500">{label}</dt>
      <dd className="mt-0.5 font-mono text-body font-medium text-ink-800">
        {value}
        {delta}
      </dd>
    </div>
  );
}

export function TotalsStrip({ cur, prev }: { cur: Daily; prev: Daily | null }) {
  const t = cur.totals;
  const p = prev?.totals;
  return (
    <dl className={`${tileCls} mb-6 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-6`}>
      <Stat label="Posts" value={count(t.postCount)} delta={<Delta cur={t.postCount} prev={p?.postCount} />} />
      <Stat label="Reach" value={count(t.reach)} delta={<Delta cur={t.reach} prev={p?.reach} />} />
      <Stat label="Shown" value={count(t.impressions)} delta={<Delta cur={t.impressions} prev={p?.impressions} />} />
      <Stat label="Interactions" value={count(engagement(t))} delta={<Delta cur={engagement(t)} prev={p ? engagement(p) : undefined} />} />
      <Stat label="Interaction rate" value={pct(engagementRate(t))} />
      <Stat label="Link clicks" value={count(t.clicks)} delta={<Delta cur={t.clicks} prev={p?.clicks} />} />
    </dl>
  );
}

/** Interactions per day as bars. An image for people who can see it; the same numbers are in the platform table and the top posts. */
export function DayChart({ cur, window: w }: { cur: Daily; window: Window }) {
  const days = fillDays(cur.days, w);
  const values = days.map((d) => engagement(d.metrics));
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const W = 720;
  const H = 120;
  const gap = days.length > 120 ? 0 : 2;
  const bw = Math.max(1, (W - gap * (days.length - 1)) / days.length);
  const peak = days[values.indexOf(Math.max(...values))];
  return (
    <figure className="mb-6">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Interactions per day, ${total.toLocaleString("en-US")} in total. The busiest day was ${fmtDay(peak.date)}.`} className="h-32 w-full text-brand-500">
        {days.map((d, i) => {
          const h = (values[i] / max) * (H - 4);
          return <rect key={d.date} x={i * (bw + gap)} y={H - h} width={bw} height={Math.max(h, values[i] > 0 ? 2 : 0)} rx={bw > 4 ? 2 : 0} fill="currentColor" opacity={values[i] > 0 ? 1 : 0.15} />;
        })}
      </svg>
      <figcaption className="mt-2 flex justify-between text-caption text-ink-500">
        <span>{fmtDay(days[0].date)}</span>
        <span>Interactions per day</span>
        <span>{fmtDay(days[days.length - 1].date)}</span>
      </figcaption>
    </figure>
  );
}

export function PlatformTable({ cur }: { cur: Daily }) {
  if (cur.platforms.length === 0) return null;
  return (
    <section aria-label="By platform" className="mb-6">
      <h2 className="mb-3 text-small font-semibold text-ink-800">By platform</h2>
      <div className="overflow-x-auto rounded-bubble border border-hairline bg-paper-0">
        <table className="w-full min-w-xl text-left text-small">
          <thead className="text-caption text-ink-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Platform</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Posts</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Reach</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Interactions</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Per post</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Rate</th>
            </tr>
          </thead>
          <tbody>
            {cur.platforms.map((p) => (
              <tr key={p.platform} className="border-t border-hairline">
                <th scope="row" className="px-4 py-3 font-semibold text-ink-800">{platformLabel(p.platform)}</th>
                <td className="px-4 py-3 text-right font-mono">{count(p.postCount)}</td>
                <td className="px-4 py-3 text-right font-mono">{count(p.reach)}</td>
                <td className="px-4 py-3 text-right font-mono">{count(engagement(p))}</td>
                <td className="px-4 py-3 text-right font-mono">{p.postCount > 0 ? count(Math.round(engagement(p) / p.postCount)) : "—"}</td>
                <td className="px-4 py-3 text-right font-mono">{pct(engagementRate(p))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Notes({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return null;
  const tone = { ok: "ok", warn: "warn", info: "info" } as const;
  return (
    <section aria-label="What the numbers say" className="mb-6 space-y-3">
      <h2 className="text-small font-semibold text-ink-800">What the numbers say</h2>
      <ul className="space-y-3">
        {notes.map((n) => (
          <li key={n.id} className="rounded-bubble border border-hairline bg-paper-0 p-4">
            <Chip tone={tone[n.tone]}>{n.title}</Chip>
            <p className="mt-2 text-small text-ink-800">{n.why}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TopPosts({ posts, tz }: { posts: PostRow[]; tz: string }) {
  const top = [...posts].filter((p) => p.interactions > 0).sort((a, b) => b.interactions - a.interactions).slice(0, 8);
  if (top.length === 0) return null;
  return (
    <section aria-label="Best posts" className="mb-6">
      <h2 className="mb-3 text-small font-semibold text-ink-800">Best posts</h2>
      <ul className="space-y-3">
        {top.map((p) => (
          <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 rounded-bubble border border-hairline bg-paper-0 p-4">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-small text-ink-800">{p.text || "(no caption)"}</p>
              <p className="mt-1 text-caption text-ink-500">
                {platformLabel(p.platform)}
                {p.at ? ` · ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: tz }).format(new Date(p.at))}` : ""}
                {p.reach !== null ? ` · reach ${count(p.reach)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-small font-medium text-ink-800">{count(p.interactions)} interactions</span>
              {p.url && (
                <a href={p.url} target="_blank" rel="noopener noreferrer" className={btnCls("ghost", "sm")}>
                  Open post
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProblemNotice({ slug, problem, canSetup }: { slug: string; problem: Problem; canSetup: boolean }) {
  const setup = problem.kind === "no-key" || problem.kind === "auth";
  return (
    <EmptyState icon={<Share2 className="size-6" aria-hidden />} title={problem.kind === "no-key" ? "Connect Zernio to see social media numbers" : "Social media numbers could not be loaded"} hint={problem.kind === "no-key" ? (canSetup ? "Add this brand's Zernio key and connect its accounts in Zernio. Reach, posts and interactions show up here." : "The founder adds the brand's Zernio key. Ask them to.") : problem.message}>
      {setup && canSetup && (
        <Link href={`/hub/b/${slug}/settings/social`} className={btnCls("primary", "md")}>
          Open Social media connections
        </Link>
      )}
    </EmptyState>
  );
}
