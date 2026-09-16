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

// Valid Instagram metrics per Zernio (invalid ones like views/profile_visits 400).
const METRICS = [
  "reach",
  "total_interactions",
  "accounts_engaged",
  "comments",
  "likes",
  "saves",
  "shares",
  "follows_and_unfollows",
  "profile_links_taps",
  "replies",
  "reposts",
].join(",");

function metricsToTotals(mx: Record<string, unknown>): MetricTotals {
  // Each metric arrives as { total: N }; num() unwraps it.
  const reach = num(mx.reach);
  const totalInteractions = num(mx.total_interactions);
  return {
    posts: 0,
    reach,
    impressions: null, // Zernio does not expose impressions/views at account level
    likes: num(mx.likes),
    comments: num(mx.comments),
    shares: num(mx.shares),
    saved: num(mx.saves),
    profileVisits: null, // not a valid account-level Zernio metric
    follows: num(mx.follows_and_unfollows),
    webClicks: num(mx.profile_links_taps),
    accountsEngaged: num(mx.accounts_engaged),
    replies: num(mx.replies),
    reposts: num(mx.reposts),
    totalInteractions,
    erReach: reach && totalInteractions ? totalInteractions / reach : null,
  };
}

export type ZernioAccount = {
  id: string;
  username: string | null;
  displayName: string | null;
  platform: string | null;
  followers: number | null;
};

/** List the Instagram accounts connected to a Zernio key. Never throws. */
export async function listZernioAccounts(apiKey: string): Promise<{ ok: boolean; accounts: ZernioAccount[]; error?: string }> {
  const base = baseUrl();
  if (!apiKey) return { ok: false, accounts: [], error: "API key kosong." };
  try {
    const res = await fetch(`${base}/v1/accounts`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, accounts: [], error: `Zernio ${res.status}: ${body.slice(0, 160)}` };
    }
    const j = (await res.json()) as Record<string, unknown>;
    const list = (j.accounts ?? j.data ?? []) as Record<string, unknown>[];
    // Show ALL platforms (Instagram, TikTok, …) so the user can pick any account.
    const accounts = (Array.isArray(list) ? list : [])
      .map((a) => ({
        id: String(a._id ?? a.id ?? ""),
        username: (a.username as string) ?? null,
        displayName: (a.displayName as string) ?? (a.name as string) ?? null,
        platform: (a.platform as string) ?? "instagram",
        followers: num(a.followersCount ?? a.followers ?? a.fanCount ?? a.followers_count),
      }))
      .filter((a) => a.id);
    return { ok: true, accounts };
  } catch (e) {
    return { ok: false, accounts: [], error: `Gagal menghubungi Zernio: ${(e as Error).message}` };
  }
}

export async function fetchZernioMetrics(opts: {
  apiKey: string | null;
  accountId: string | null;
  period?: string;
  since?: string; // explicit range (YYYY-MM-DD) from the calendar picker
  until?: string;
}): Promise<ReportMetrics> {
  const period = opts.period ?? "last_30d";
  const base = baseUrl();
  if (!opts.apiKey) {
    return { connected: false, provider: "zernio", posts: [], reason: "Client belum menghubungkan akun Zernio (API key kosong)." };
  }
  if (!opts.accountId) {
    return { connected: false, provider: "zernio", posts: [], reason: "Zernio Profile ID (SocialAccount id) belum diisi." };
  }
  const { apiKey, accountId } = opts;
  const AH = { Authorization: `Bearer ${apiKey}`, Accept: "application/json" };
  // Explicit calendar range wins; otherwise derive from the period label.
  const { since, until } =
    opts.since && opts.until ? { since: opts.since, until: opts.until } : dateRange(period);
  const insightsUrl = (extra: Record<string, string>) => {
    const qs = new URLSearchParams({ accountId, metrics: METRICS, metricType: "total_value", ...extra });
    if (since) qs.set("since", since);
    if (until) qs.set("until", until);
    return `${base}/v1/analytics/instagram/account-insights?${qs.toString()}`;
  };
  const getJson = async (url: string) => {
    const r = await fetch(url, { headers: AH, cache: "no-store" });
    if (!r.ok) throw new Error(`${r.status}: ${(await r.text().catch(() => "")).slice(0, 160)}`);
    return (await r.json()) as Record<string, unknown>;
  };

  try {
    // Core totals first (fail → not-connected with the real reason).
    const core = await getJson(insightsUrl({}));
    const totals = metricsToTotals((core.metrics ?? {}) as Record<string, unknown>);

    // Everything else best-effort in parallel (a failure just omits that section).
    const settle = <T>(p: Promise<T>): Promise<T | null> => p.then((x) => x).catch(() => null);
    const range = `${since ? `&since=${since}` : ""}${until ? `&until=${until}` : ""}`;
    const bd = (metrics: string, breakdown: string) =>
      `${base}/v1/analytics/instagram/account-insights?accountId=${accountId}&metrics=${metrics}&metricType=total_value&breakdown=${breakdown}${range}`;
    const fhUrl = `${base}/v1/analytics/instagram/follower-history?accountId=${accountId}&metrics=follower_count,followers_gained,followers_lost&metricType=time_series${range}`;
    const demoUrl = `${base}/v1/analytics/instagram/demographics?accountId=${accountId}&metric=follower_demographics&breakdown=age,city,country,gender`;
    const [ctJson, ftJson, cbJson, tsJson, fhJson, demoJson, postsJson, accts] = await Promise.all([
      settle(getJson(bd("reach,total_interactions", "media_product_type"))),
      settle(getJson(bd("reach", "follow_type"))),
      settle(getJson(bd("profile_links_taps", "contact_button_type"))),
      settle(getJson(insightsUrl({ metrics: "reach", metricType: "time_series" }))), // only reach supports time_series
      settle(getJson(fhUrl)),
      settle(getJson(demoUrl)),
      settle(getJson(`${base}/v1/analytics?platform=instagram&accountId=${accountId}&limit=50`)),
      settle(listZernioAccounts(apiKey!)),
    ]);

    // content-type breakdown (reach + interactions per POST/STORY/REEL/CAROUSEL)
    let byContentType = null as null | { type: string; reach: number | null; interactions: number | null }[];
    if (ctJson) {
      const m = (ctJson.metrics ?? {}) as Record<string, Record<string, unknown>>;
      const rB = (m.reach?.breakdowns ?? []) as Record<string, unknown>[];
      const iB = (m.total_interactions?.breakdowns ?? []) as Record<string, unknown>[];
      const iMap = new Map(iB.map((b) => [String(b.dimension), num(b.value)]));
      byContentType = rB.map((b) => ({
        type: String(b.dimension),
        reach: num(b.value),
        interactions: iMap.get(String(b.dimension)) ?? null,
      }));
    }

    // discovery split (follower vs non-follower reach)
    let discovery = null as null | { followers: number | null; nonFollowers: number | null };
    if (ftJson) {
      const rB = (((ftJson.metrics ?? {}) as Record<string, Record<string, unknown>>).reach?.breakdowns ?? []) as Record<string, unknown>[];
      const find = (d: string) => num(rB.find((b) => String(b.dimension) === d)?.value);
      discovery = { followers: find("FOLLOWER"), nonFollowers: find("NON_FOLLOWER") };
    }

    // contact-button breakdown (how profile taps split)
    let contactButtons = null as null | { type: string; value: number }[];
    if (cbJson) {
      const rB = (((cbJson.metrics ?? {}) as Record<string, Record<string, unknown>>).profile_links_taps?.breakdowns ?? []) as Record<string, unknown>[];
      const list = rB.map((b) => ({ type: String(b.dimension), value: num(b.value) ?? 0 })).filter((x) => x.value > 0);
      if (list.length) contactButtons = list;
    }

    // daily series helper
    const seriesOf = (j: Record<string, unknown> | null, key: string) => {
      if (!j) return null;
      const vals = (((j.metrics ?? {}) as Record<string, Record<string, unknown>>)[key]?.values ?? []) as Record<string, unknown>[];
      return vals.length ? vals.map((v) => ({ date: String(v.date), value: num(v.value) ?? 0 })) : null;
    };
    const reachSeries = seriesOf(tsJson, "reach");

    // follower history: daily count + gained/lost totals; refine the follower number
    const followerSeries = seriesOf(fhJson, "follower_count");
    const fhm = (fhJson?.metrics ?? {}) as Record<string, Record<string, unknown>>;
    const sumVals = (k: string) => {
      const vals = (fhm[k]?.values ?? []) as Record<string, unknown>[];
      return vals.length ? vals.reduce((a, v) => a + (num(v.value) ?? 0), 0) : num(fhm[k]?.total);
    };
    const followersGained = sumVals("followers_gained");
    const followersLost = sumVals("followers_lost");
    const latestFollowers = followerSeries?.length ? followerSeries[followerSeries.length - 1].value : null;

    // audience demographics (age / gender / city / country)
    let demographics = null as null | {
      ages?: { name: string; value: number }[];
      genders?: { name: string; value: number }[];
      cities?: { name: string; value: number }[];
      countries?: { name: string; value: number }[];
    };
    if (demoJson?.demographics) {
      const d = demoJson.demographics as Record<string, Record<string, unknown>[]>;
      const conv = (arr?: Record<string, unknown>[]) =>
        (arr ?? []).map((x) => ({ name: String(x.dimension ?? x.name), value: num(x.value) ?? 0 })).filter((x) => x.value > 0);
      demographics = {
        ages: conv(d.age),
        genders: conv(d.gender),
        cities: conv(d.city).slice(0, 6),
        countries: conv(d.country).slice(0, 6),
      };
    }

    // impressions come from the unified overview (not account-insights)
    const overview = (postsJson?.overview ?? {}) as Record<string, unknown>;
    const ovImpr = num(overview.totalImpressions);
    if (ovImpr != null) totals.impressions = ovImpr;

    // per-post analytics
    const posts: PostMetric[] = [];
    if (postsJson && Array.isArray(postsJson.posts)) {
      for (const p of postsJson.posts as Record<string, unknown>[]) {
        const a = (p.analytics ?? {}) as Record<string, unknown>;
        const likes = num(a.likes), comments = num(a.comments), shares = num(a.shares), saves = num(a.saves);
        const ti = [likes, comments, shares, saves].some((x) => x !== null)
          ? (likes ?? 0) + (comments ?? 0) + (shares ?? 0) + (saves ?? 0)
          : null;
        const dur = num(a.videoDurationSeconds) ?? num(a.igReelsVideoViewTotalTime);
        posts.push({
          date: String(p.publishedAt ?? p.scheduledFor ?? "").slice(0, 10),
          caption: String(p.content ?? "").replace(/\s+/g, " ").trim(),
          format: dur ? "Reels / Video" : "Post",
          reach: num(a.reach),
          impressions: num(a.impressions),
          likes, comments, shares, saved: saves,
          views: num(a.views),
          follows: num(a.follows),
          profileVisits: num(a.profileViews),
          webClicks: num(a.clicks),
          totalInteractions: ti,
          engagementRate: num(a.engagementRate),
          url: null,
        });
      }
      posts.sort((x, y) => (y.date || "").localeCompare(x.date || ""));
      totals.posts = posts.length;
    }

    const acct = accts?.accounts.find((a) => a.id === accountId) ?? accts?.accounts[0];
    const dr = (core.dateRange ?? {}) as Record<string, unknown>;
    return {
      connected: true,
      provider: "zernio",
      period: dr.since && dr.until ? `${dr.since} → ${dr.until}` : period,
      account: {
        username: acct?.username ?? acct?.displayName ?? null,
        followers: latestFollowers ?? acct?.followers ?? null,
      },
      posts,
      totals,
      discovery,
      byContentType,
      reachSeries,
      followerSeries,
      followersGained,
      followersLost,
      contactButtons,
      demographics,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    return { connected: false, provider: "zernio", posts: [], reason: `Zernio API ${(e as Error).message}` };
  }
}
