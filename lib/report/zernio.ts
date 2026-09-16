import "server-only";
import type { PostMetric, ReportMetrics, MetricTotals } from "@/lib/report/types";

/**
 * Zernio adapter — the per-client data source that REPLACES Apify on the
 * report platform. Each client connects their OWN Zernio account, so we call
 * Zernio with that client's key + Zernio SocialAccount id.
 *
 * Real API (docs.zernio.com):
 *   Base:   https://zernio.com/api           (override with ZERNIO_BASE_URL)
 *   Auth:   Authorization: Bearer <client key>
 *   GET /v1/analytics/instagram/account-insights
 *          ?accountId={id}&metrics=...&since=YYYY-MM-DD&until=YYYY-MM-DD
 *          → { accountId, platform, dateRange, metricType, metrics:{ reach, views,
 *              total_interactions, comments, likes, saves, shares,
 *              follows_and_unfollows, profile_links_taps, profile_visits, ... } }
 *   GET /v1/accounts/{id}/instagram/follower-history  (best-effort followers)
 *
 * HARD RULE: never fabricate. If not configured / key missing / call fails,
 * return {connected:false, reason} so the UI shows a not-connected state.
 */

const DEFAULT_BASE = "https://zernio.com/api";

function baseUrl(): string {
  const b = (process.env.ZERNIO_BASE_URL ?? "").trim();
  return (b || DEFAULT_BASE).replace(/\/$/, "");
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return num(o.value ?? o.total ?? o.count);
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Resolve a period label to a since/until date range (YYYY-MM-DD). */
function dateRange(period: string): { since?: string; until?: string } {
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const since = new Date(Date.UTC(y, mo - 1, 1));
    const until = new Date(Date.UTC(y, mo, 0)); // last day of month
    return { since: ymd(since), until: ymd(until) };
  }
  if (period === "last_90d") {
    const until = new Date();
    const since = new Date(until.getTime() - 90 * 864e5);
    return { since: ymd(since), until: ymd(until) };
  }
  // last_30d → let Zernio default (30 days)
  return {};
}

const METRICS = [
  "reach",
  "views",
  "total_interactions",
  "accounts_engaged",
  "comments",
  "likes",
  "saves",
  "shares",
  "follows_and_unfollows",
  "profile_links_taps",
  "profile_visits",
].join(",");

function metricsToTotals(mx: Record<string, unknown>): MetricTotals {
  const reach = num(mx.reach);
  const totalInteractions = num(mx.total_interactions);
  return {
    posts: 0,
    reach,
    impressions: num(mx.views), // "views" is the modern Instagram impressions metric
    likes: num(mx.likes),
    comments: num(mx.comments),
    shares: num(mx.shares),
    saved: num(mx.saves),
    profileVisits: num(mx.profile_visits),
    follows: num(mx.follows_and_unfollows),
    webClicks: num(mx.profile_links_taps),
    totalInteractions,
    erReach: reach && totalInteractions ? totalInteractions / reach : null,
  };
}

async function followerCount(base: string, apiKey: string, accountId: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${base}/v1/accounts/${encodeURIComponent(accountId)}/instagram/follower-history`,
      { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    const series = (j.history ?? j.data ?? j.series ?? []) as Record<string, unknown>[];
    if (Array.isArray(series) && series.length) {
      const last = series[series.length - 1];
      return num(last.followers ?? last.count ?? last.total ?? last.value);
    }
    return num(j.followers ?? j.total);
  } catch {
    return null;
  }
}

export async function fetchZernioMetrics(opts: {
  apiKey: string | null;
  accountId: string | null;
  period?: string;
}): Promise<ReportMetrics> {
  const period = opts.period ?? "last_30d";
  const base = baseUrl();
  if (!opts.apiKey) {
    return { connected: false, provider: "zernio", posts: [], reason: "Client belum menghubungkan akun Zernio (API key kosong)." };
  }
  if (!opts.accountId) {
    return { connected: false, provider: "zernio", posts: [], reason: "Zernio Profile ID (SocialAccount id) belum diisi." };
  }
  try {
    const { since, until } = dateRange(period);
    const qs = new URLSearchParams({ accountId: opts.accountId, metrics: METRICS, metricType: "total_value" });
    if (since) qs.set("since", since);
    if (until) qs.set("until", until);
    const url = `${base}/v1/analytics/instagram/account-insights?${qs.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${opts.apiKey}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { connected: false, provider: "zernio", posts: [], reason: `Zernio API ${res.status}: ${body.slice(0, 180)}` };
    }
    const json = (await res.json()) as Record<string, unknown>;
    const mx = (json.metrics ?? json.data ?? {}) as Record<string, unknown>;
    const totals = metricsToTotals(mx);
    const followers = await followerCount(base, opts.apiKey, opts.accountId);
    const dr = (json.dateRange ?? {}) as Record<string, unknown>;
    return {
      connected: true,
      provider: "zernio",
      period: dr.since && dr.until ? `${dr.since} → ${dr.until}` : period,
      account: {
        username: (json.username as string) ?? (json.handle as string) ?? null,
        followers,
      },
      posts: [] as PostMetric[], // account-level insights; per-post endpoint not in Zernio's documented analytics
      totals,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    return { connected: false, provider: "zernio", posts: [], reason: `Gagal menghubungi Zernio: ${(e as Error).message}` };
  }
}
