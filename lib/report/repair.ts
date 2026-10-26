// Read-time repair of stored report snapshots. PURE (no server-only), so tests can run it directly.
//
// A snapshot is a copy of what the pipeline produced on the day it was pulled. Snapshots saved before the 2026-10-26
// fixes in lib/report/zernio.ts can hold numbers that are provably wrong *from the snapshot itself*:
//   · posts outside the report period (the list used to be fetched without a date range, then not always filtered),
//   · TikTok "Likes" = the account's lifetime likes (the same value for every date range) next to post-level comments,
//     shares and saves, so Likes could exceed Total Interactions,
//   · TikTok impressions = 0 beside reach and views (TikTok has no impressions metric; a 0 is "not available"),
//   · Instagram account totals for impressions / profile visits, which were post sums written into an account figure.
// Anything that needs the platform again (a post the old pull never fetched) cannot be repaired here: "Tarik data" does it.
// A fresh snapshot passes through untouched (same object back).

import type { MetricTotals, PostMetric, ReportMetrics } from "@/lib/report/types";
import { reelsSummary } from "@/lib/report/derive";

/** Revision of the pipeline in lib/report/zernio.ts. 2 = posts fetched for the report range (fromDate/toDate, every page)
 *  and TikTok totals summed from those posts. A snapshot without `rev` was pulled before that. */
export const PIPELINE_REV = 2;

/** "2026-10-01 → 2026-10-16" → its two dates; null for a label such as "last_30d". */
export function periodRange(period?: string): { since: string; until: string } | null {
  const found = period?.match(/\d{4}-\d{2}-\d{2}/g);
  return found && found.length >= 2 ? { since: found[0], until: found[found.length - 1] } : null;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const same = (a: number | null | undefined, b: number | null | undefined) => (a ?? null) === (b ?? null);

/** A post that reached people or got views was shown at least that often: impressions of 0 next to them mean the
 *  platform has no such metric, not that nobody saw the post. */
export function impossibleZeroImpressions(p: PostMetric): boolean {
  return p.impressions === 0 && ((p.reach ?? 0) > 0 || (p.views ?? 0) > 0);
}

export function repairMetrics(m: ReportMetrics): ReportMetrics {
  if (!m.connected) return m;
  const notes: string[] = [];
  let touched = false;
  let posts = m.posts ?? [];

  // Only an old pull needs the period filter: a current one already asked Zernio for exactly the requested range, and its
  // period label can differ from that range when Zernio clamps the account insights.
  const range = (m.rev ?? 1) < PIPELINE_REV ? periodRange(m.period) : null;
  if (range) {
    const inside = posts.filter((p) => !p.date || (p.date >= range.since && p.date <= range.until));
    if (inside.length !== posts.length) {
      const out = posts.length - inside.length;
      notes.push(
        `${out} post di luar periode ${range.since} → ${range.until} disembunyikan — laporan ini ditarik sebelum perbaikan rentang tanggal. Klik “Tarik data” untuk memperbarui.`,
      );
      posts = inside;
      touched = true;
    }
  }

  let zeroImpressions = 0;
  posts = posts.map((p) => {
    if (!impossibleZeroImpressions(p)) return p;
    zeroImpressions++;
    return { ...p, impressions: null };
  });
  if (zeroImpressions) {
    notes.push(`Impressions ${zeroImpressions} post bernilai 0 padahal punya reach/views — ditampilkan n/a (platform tidak menyediakan impressions).`);
    touched = true;
  }

  const platform = (m.platform ?? "instagram").toLowerCase();
  let totals: MetricTotals | null | undefined = m.totals;
  if (totals) {
    if (platform === "instagram") {
      // Zernio has no account-level impressions / profile visits; older pulls wrote post sums here.
      if (totals.impressions != null || totals.profileVisits != null || totals.posts !== posts.length) {
        totals = { ...totals, posts: posts.length, impressions: null, profileVisits: null };
        touched = true;
      }
    } else {
      // TikTok has no account-level reach, so every total is a post-scope sum (see MetricTotals).
      const sum = (pick: (p: PostMetric) => number | null | undefined) => {
        const v = posts.map(pick).filter(isNum);
        return v.length ? v.reduce((a, b) => a + b, 0) : null;
      };
      const reach = sum((p) => p.reach);
      const ti = sum((p) => p.totalInteractions);
      const next: MetricTotals = {
        ...totals,
        posts: posts.length,
        reach,
        impressions: sum((p) => p.impressions),
        likes: sum((p) => p.likes),
        comments: sum((p) => p.comments),
        shares: sum((p) => p.shares),
        saved: sum((p) => p.saved),
        profileVisits: sum((p) => p.profileVisits),
        follows: sum((p) => p.follows),
        totalInteractions: ti,
        erReach: reach && ti ? ti / reach : null,
      };
      const differs = (["posts", "reach", "impressions", "likes", "comments", "shares", "saved", "profileVisits", "follows", "totalInteractions"] as const).some(
        (k) => !same(totals![k], next[k]),
      );
      if (differs) {
        if (isNum(totals.likes) && totals.likes !== next.likes) {
          notes.push(
            `Likes TikTok dihitung ulang dari post di periode (${(next.likes ?? 0).toLocaleString("id-ID")}) — angka lama ${totals.likes.toLocaleString("id-ID")} adalah total like seumur akun.`,
          );
        }
        totals = next;
        touched = true;
      }
    }
  }

  if (!touched) return m;
  return { ...m, posts, totals, reels: reelsSummary(posts), dataNotes: [...(m.dataNotes ?? []), ...notes] };
}
