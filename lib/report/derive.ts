// Shared, PURE derivations for the report — imported by BOTH the dashboard
// (components/report/report-dashboard.tsx) and the Excel builder (lib/report/excel.ts)
// so the two are guaranteed identical. No side effects, no "server-only".
//
// SCOPES — every number belongs to exactly one, and a rate keeps its numerator
// and denominator in the same one:
//   A (account): MetricTotals from the account-insights endpoint — ALL content
//                (posts, stories, reels), each account counted once.
//   P (posts):   figures summed/averaged from `posts` — only posts published in
//                the selected range.
// Dividing an A figure by a post count (or P by A) is how "Avg Reach / Post"
// once showed account reach ÷ posts and "Impressions" sat below Reach.
// See efficiency() and postTotal().

import type { PostMetric, MetricTotals, PeriodComparison, ReelsSummary } from "@/lib/report/types";

/**
 * Total Actions (client convention, Cap Gajah) = every action on a post summed:
 * likes + comments + follows + profile visits + shares + saved + web clicks.
 * It is NOT Instagram's `total_interactions` — it also counts follows, profile
 * visits and web clicks — so it is labelled "Total Actions", never "Interactions".
 * (The Cap Gajah "Others" column is not tracked → 0.)
 */
export function totalActions(p: PostMetric): number {
  return (
    (p.likes ?? 0) + (p.comments ?? 0) + (p.follows ?? 0) + (p.profileVisits ?? 0) +
    (p.shares ?? 0) + (p.saved ?? 0) + (p.webClicks ?? 0)
  );
}

/** Content Quality Score weights — high-intent actions count for more than likes. */
export const QS_WEIGHTS = { likes: 1, comments: 2, shares: 3, saved: 4, follows: 5, profileVisits: 1, webClicks: 2 };
export function weightedEngagement(p: PostMetric): number {
  const w = QS_WEIGHTS;
  return (
    (p.likes ?? 0) * w.likes + (p.comments ?? 0) * w.comments + (p.shares ?? 0) * w.shares +
    (p.saved ?? 0) * w.saved + (p.follows ?? 0) * w.follows + (p.profileVisits ?? 0) * w.profileVisits +
    (p.webClicks ?? 0) * w.webClicks
  );
}
/** Content Quality Score: weighted high-intent engagement per 1,000 reach. */
export function qualityScore(posts: PostMetric[]): number | null {
  const reach = posts.reduce((s, p) => s + (p.reach ?? 0), 0);
  if (!reach) return null;
  const we = posts.reduce((s, p) => s + weightedEngagement(p), 0);
  return (we / reach) * 1000;
}

const r = (num: number | null | undefined, den: number | null | undefined) =>
  num != null && den != null && den > 0 ? num / den : null;

export type Efficiency = {
  reachRate: number | null;
  erReach: number | null;
  savesRate: number | null;
  sharesRate: number | null;
  pvRate: number | null;
  followRate: number | null;
  avgReach: number | null;
  /** How many posts the P-scope figures (avgReach, pvRate) are built on. */
  reachPosts: number;
};

/** A post that already has insights (any metric above zero). Fresh posts come back from Zernio
 *  empty or all zeros — that means "not synced yet", not "nobody saw it". */
export function postHasData(p: PostMetric): boolean {
  return [p.reach, p.impressions, p.likes, p.comments, p.shares, p.saved, p.follows, p.profileVisits, p.webClicks].some(
    (v) => (v ?? 0) > 0,
  );
}

/** P-scope: sum of one per-post field over the posts that report it, and how many did.
 *  `total` is null (not 0) when no post has the field, so the UI can show "—". */
export function postTotal(
  posts: PostMetric[],
  pick: (p: PostMetric) => number | null | undefined,
): { total: number | null; n: number } {
  let total = 0, n = 0;
  for (const p of posts) {
    const v = pick(p);
    if (typeof v === "number") { total += v; n++; }
  }
  return { total: n ? total : null, n };
}

/** `t` is account-scope (A); the per-post figures are built from `posts` (P). */
export function efficiency(t: MetricTotals | null | undefined, followers: number | null | undefined, posts: PostMetric[]): Efficiency {
  // Posts with a usable reach (> 0) — the same sample topMovers() averages over.
  const reached = posts.filter((p) => (p.reach ?? 0) > 0);
  const reachSum = reached.reduce((s, p) => s + (p.reach ?? 0), 0);
  // Profile visits exist per post only (Zernio has no account-level metric), so the
  // rate is Σ post profile visits ÷ Σ reach of those same posts — never ÷ account reach.
  const visited = reached.filter((p) => typeof p.profileVisits === "number");
  return {
    reachRate: r(t?.reach, followers),
    erReach: t?.erReach ?? r(t?.totalInteractions, t?.reach),
    savesRate: r(t?.saved, t?.reach),
    sharesRate: r(t?.shares, t?.reach),
    pvRate: r(
      visited.reduce((s, p) => s + (p.profileVisits ?? 0), 0),
      visited.reduce((s, p) => s + (p.reach ?? 0), 0),
    ),
    followRate: r(t?.follows, t?.reach),
    // Avg reach per post = Σ post reach ÷ posts — NOT account reach ÷ posts.
    avgReach: r(reachSum, reached.length),
    reachPosts: reached.length,
  };
}

export type Delta = number | null;
export function pctChange(cur: number | null | undefined, prev: number | null | undefined): Delta {
  if (cur == null || prev == null || prev === 0) return null;
  return (cur - prev) / prev;
}
export type Deltas = {
  reach: Delta; totalInteractions: Delta; erReach: Delta;
  likes: Delta; comments: Delta; saved: Delta; shares: Delta;
} | null;
export function computeDeltas(t: MetricTotals | null | undefined, c: PeriodComparison | null | undefined): Deltas {
  if (!t || !c) return null;
  return {
    reach: pctChange(t.reach, c.reach),
    totalInteractions: pctChange(t.totalInteractions, c.totalInteractions),
    erReach: pctChange(t.erReach, c.erReach),
    likes: pctChange(t.likes, c.likes),
    comments: pctChange(t.comments, c.comments),
    saved: pctChange(t.saved, c.saved),
    shares: pctChange(t.shares, c.shares),
  };
}

// Best day/time — timestamps are UTC; shift to WIB (UTC+7) for local wall-clock.
const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export type BestTime = { day: string; dayAvgReach: number; hour: number; hourAvgReach: number } | null;
export function bestDayTime(posts: PostMetric[]): BestTime {
  const withTime = posts.filter((p) => p.postedAt);
  if (!withTime.length) return null;
  const dayAgg = new Map<number, { reach: number; n: number }>();
  const hourAgg = new Map<number, { reach: number; n: number }>();
  for (const p of withTime) {
    const d = new Date(p.postedAt as string);
    if (isNaN(d.getTime())) continue;
    const wib = new Date(d.getTime() + 7 * 3600 * 1000);
    const day = wib.getUTCDay(), hour = wib.getUTCHours(), reach = p.reach ?? 0;
    const da = dayAgg.get(day) ?? { reach: 0, n: 0 }; da.reach += reach; da.n++; dayAgg.set(day, da);
    const ha = hourAgg.get(hour) ?? { reach: 0, n: 0 }; ha.reach += reach; ha.n++; hourAgg.set(hour, ha);
  }
  const top = (m: Map<number, { reach: number; n: number }>) =>
    [...m.entries()].map(([k, v]) => ({ k, avg: v.reach / v.n })).sort((a, b) => b.avg - a.avg)[0];
  const bd = top(dayAgg), bh = top(hourAgg);
  if (!bd || !bh) return null;
  return { day: DAYS[bd.k], dayAvgReach: Math.round(bd.avg), hour: bh.k, hourAvgReach: Math.round(bh.avg) };
}

/** Aggregate video/Reels performance from the post list; null when there is no video. Used when a report is built
 *  (lib/report/zernio.ts) and when an old snapshot is repaired (lib/report/repair.ts), so both give the same summary. */
export function reelsSummary(posts: PostMetric[]): ReelsSummary | null {
  const vids = posts.filter((p) => p.avgWatchTime != null || p.completionRate != null || p.format === "Reels / Video");
  if (!vids.length) return null;
  const nums = (k: keyof PostMetric) => vids.map((p) => p[k]).filter((v): v is number => typeof v === "number");
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const views = nums("views");
  const watch = nums("avgWatchTime").filter((v) => v > 0); // 0 ms = no watch data yet, not an instant skip
  return {
    count: vids.length,
    totalViews: views.length ? views.reduce((a, b) => a + b, 0) : null,
    avgWatchTimeSec: watch.length ? avg(watch)! / 1000 : null,
    avgCompletion: avg(nums("completionRate")),
  };
}

export type ReelRow = {
  date: string; caption: string; views: number | null; reach: number | null;
  viewRate: number | null; avgWatchSec: number | null; completion: number | null; skip: number | null;
};
export function reelRows(posts: PostMetric[]): ReelRow[] {
  return posts
    .filter((p) => p.format === "Reels / Video" || p.avgWatchTime != null || p.completionRate != null)
    .map((p) => ({
      date: p.date,
      caption: p.caption,
      views: p.views ?? null,
      reach: p.reach ?? null,
      viewRate: r(p.views, p.reach),
      // 0 ms means Zernio had no watch data yet (a video with views is never watched for 0 s) → n/a
      avgWatchSec: p.avgWatchTime != null && p.avgWatchTime > 0 ? p.avgWatchTime / 1000 : null,
      completion: p.completionRate ?? null,
      skip: p.skipRate ?? null,
    }))
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
}

// Post movers — which posts pulled the period's numbers up vs dragged them down.
export type Mover = {
  post: PostMetric;
  reach: number;
  actions: number; // totalActions(post)
  er: number | null; // actions / reach
  shareOfReach: number; // reach / total reach in period
  reason: string;
};
export type Movers = { up: Mover[]; down: Mover[]; avgReach: number } | null;

function moverReasonUp(m: Mover, avg: number): string {
  const p = m.post, reach = m.reach;
  const sr = reach ? (p.saved ?? 0) / reach : 0;
  const shr = reach ? (p.shares ?? 0) / reach : 0;
  const bits: string[] = [];
  if (avg > 0 && reach >= avg * 1.4) bits.push(`reach ${(reach / avg).toFixed(1)}× rata-rata`);
  if (shr >= 0.005) bits.push("banyak dibagikan (viral)");
  if (sr >= 0.005) bits.push("banyak disimpan (bernilai)");
  if (m.er != null && m.er >= 0.05) bits.push(`ER ${(m.er * 100).toFixed(1)}% kuat`);
  if (!bits.length) bits.push("kontributor reach terbesar");
  return bits.join(" · ");
}
function moverReasonDown(m: Mover, avg: number): string {
  const reach = m.reach;
  const bits: string[] = [avg > 0 ? `reach ${Math.round((reach / avg) * 100)}% dari rata-rata` : "reach rendah"];
  if (m.er != null && m.er < 0.02) bits.push("engagement rendah");
  else if (m.er != null && m.er >= 0.05) bits.push("ER bagus tapi jangkauan kecil");
  return bits.join(" · ");
}

/** Top posts driving results up vs underperformers dragging them down.
 *  How many each way scales with post count: ≤5 → 1, ≤10 → 2, >10 → 3
 *  (override with an explicit `n`). */
export function topMovers(posts: PostMetric[], n?: number): Movers {
  const valid = posts.filter((p) => (p.reach ?? 0) > 0);
  if (valid.length < 2) return null;
  const k = n ?? (valid.length <= 5 ? 1 : valid.length <= 10 ? 2 : 3);
  const totalReach = valid.reduce((s, p) => s + (p.reach ?? 0), 0);
  const avgReach = totalReach / valid.length;
  const enrich = (p: PostMetric): Mover => {
    const reach = p.reach ?? 0;
    const actions = totalActions(p);
    return { post: p, reach, actions, er: reach ? actions / reach : null, shareOfReach: totalReach ? reach / totalReach : 0, reason: "" };
  };
  const byReach = valid.map(enrich).sort((a, b) => b.reach - a.reach);
  const up = byReach.slice(0, k).map((m) => ({ ...m, reason: moverReasonUp(m, avgReach) }));
  const upSet = new Set(up.map((m) => m.post));
  // drags = below-average posts NOT already counted as drivers, worst first
  const down = byReach
    .filter((m) => !upSet.has(m.post) && m.reach < avgReach)
    .slice(-k)
    .reverse()
    .map((m) => ({ ...m, reason: moverReasonDown(m, avgReach) }));
  return { up, down, avgReach };
}

export type OverlapRow = { name: string; follower: number; engaged: number; gap: number };
export function overlapRows(
  follower?: { name: string; value: number }[],
  engaged?: { name: string; value: number }[],
): OverlapRow[] {
  const norm = (arr?: { name: string; value: number }[]) => {
    const tot = (arr ?? []).reduce((s, x) => s + x.value, 0) || 1;
    const m = new Map<string, number>();
    (arr ?? []).forEach((x) => m.set(x.name, x.value / tot));
    return m;
  };
  const f = norm(follower), e = norm(engaged);
  const names = [...new Set([...f.keys(), ...e.keys()])];
  return names
    .map((name) => ({ name, follower: f.get(name) ?? 0, engaged: e.get(name) ?? 0, gap: (e.get(name) ?? 0) - (f.get(name) ?? 0) }))
    .sort((a, b) => b.engaged - a.engaged);
}
