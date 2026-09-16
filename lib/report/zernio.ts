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
  /** Which of the client's Zernio connections (API keys) this account belongs to. */
  keyId?: string;
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

/** Map a unified /v1/analytics posts payload to PostMetric[] (IG + TikTok). */
function mapPosts(postsJson: Record<string, unknown> | null): PostMetric[] {
  const posts: PostMetric[] = [];
  if (postsJson && Array.isArray(postsJson.posts)) {
    for (const p of postsJson.posts as Record<string, unknown>[]) {
      const a = (p.analytics ?? {}) as Record<string, unknown>;
      const likes = num(a.likes), comments = num(a.comments), shares = num(a.shares), saves = num(a.saves);
      const ti = [likes, comments, shares, saves].some((x) => x !== null)
        ? (likes ?? 0) + (comments ?? 0) + (shares ?? 0) + (saves ?? 0)
        : null;
      const watch = num(a.igReelsAvgWatchTime);
      const isVideo = watch != null || num(a.videoDurationSeconds) != null || num(a.completionRate) != null;
      posts.push({
        date: String(p.publishedAt ?? p.scheduledFor ?? "").slice(0, 10),
        caption: String(p.content ?? "").replace(/\s+/g, " ").trim(),
        format: isVideo ? "Reels / Video" : "Post",
        reach: num(a.reach),
        impressions: num(a.impressions),
        likes, comments, shares, saved: saves,
        views: num(a.views),
        follows: num(a.follows),
        profileVisits: num(a.profileViews),
        webClicks: num(a.clicks),
        totalInteractions: ti,
        engagementRate: num(a.engagementRate),
        avgWatchTime: watch,
        completionRate: num(a.completionRate),
        skipRate: num(a.reelsSkipRate),
        url: null,
      });
    }
    posts.sort((x, y) => (y.date || "").localeCompare(x.date || ""));
  }
  return posts;
}

/** Aggregate video/Reels performance from the post list. */
function computeReels(posts: PostMetric[]) {
  const vids = posts.filter((p) => p.avgWatchTime != null || p.completionRate != null || p.format === "Reels / Video");
  if (!vids.length) return null;
  const nums = (k: keyof PostMetric) => vids.map((p) => p[k]).filter((v): v is number => typeof v === "number");
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const views = nums("views");
  const watch = nums("avgWatchTime");
  return {
    count: vids.length,
    totalViews: views.length ? views.reduce((a, b) => a + b, 0) : null,
    avgWatchTimeSec: watch.length ? avg(watch)! / 1000 : null,
    avgCompletion: avg(nums("completionRate")),
  };
}

/** Instagram Stories: list + per-story insights → aggregate + list. */
async function fetchStories(base: string, apiKey: string, accountId: string) {
  const AH = { Authorization: `Bearer ${apiKey}`, Accept: "application/json" };
  try {
    const list = (await fetch(`${base}/v1/accounts/${accountId}/instagram/stories`, { headers: AH, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)) as Record<string, unknown> | null;
    const stories = (list?.data ?? []) as Record<string, unknown>[];
    if (!Array.isArray(stories) || !stories.length) return null;
    const items = await Promise.all(
      stories.slice(0, 20).map(async (s) => {
        const ins = (await fetch(`${base}/v1/accounts/${accountId}/instagram/stories/${s.id}/insights`, { headers: AH, cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)) as Record<string, unknown> | null;
        const m = ((ins?.data as Record<string, unknown>)?.metrics ?? {}) as Record<string, unknown>;
        return {
          date: String(s.timestamp ?? "").slice(0, 10),
          mediaType: String(s.mediaType ?? ""),
          views: num(m.views), reach: num(m.reach), replies: num(m.replies), exits: num(m.exits),
          tapsForward: num(m.tapsForward), tapsBack: num(m.tapsBack),
          profileVisits: num(m.profileVisits), follows: num(m.follows),
        };
      }),
    );
    const sum = (k: keyof (typeof items)[number]) => {
      const v = items.map((i) => i[k]).filter((x): x is number => typeof x === "number");
      return v.length ? v.reduce((a, b) => a + b, 0) : null;
    };
    return {
      count: items.length,
      views: sum("views"), reach: sum("reach"), replies: sum("replies"), exits: sum("exits"),
      tapsForward: sum("tapsForward"), tapsBack: sum("tapsBack"),
      profileVisits: sum("profileVisits"), follows: sum("follows"),
      items,
    };
  } catch {
    return null;
  }
}

/** TikTok pipeline — account counters + per-post analytics (no account-level reach on TikTok). */
async function fetchTikTok(
  base: string,
  apiKey: string,
  accountId: string,
  since: string | undefined,
  until: string | undefined,
  period: string,
  acct: ZernioAccount | undefined,
): Promise<ReportMetrics> {
  const AH = { Authorization: `Bearer ${apiKey}`, Accept: "application/json" };
  const range = `${since ? `&since=${since}` : ""}${until ? `&until=${until}` : ""}`;
  const get = (url: string) => fetch(url, { headers: AH, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [insJson, postsJson] = await Promise.all([
    get(`${base}/v1/analytics/tiktok/account-insights?accountId=${accountId}&metrics=follower_count,likes_count,video_count,followers_gained,followers_lost&metricType=total_value${range}`),
    get(`${base}/v1/analytics?platform=tiktok&accountId=${accountId}&limit=50`),
  ]);
  const mx = ((insJson as Record<string, unknown>)?.metrics ?? {}) as Record<string, Record<string, unknown>>;
  const posts = mapPosts(postsJson as Record<string, unknown> | null);
  // TikTok exposes only a current follower_count (no daily history) → use it per post.
  const tkFollowers = num(mx.follower_count?.total);
  for (const p of posts) p.followersAtPeriod = tkFollowers;
  const sum = (k: keyof PostMetric) => {
    const v = posts.map((p) => p[k]).filter((x): x is number => typeof x === "number");
    return v.length ? v.reduce((a, b) => a + b, 0) : null;
  };
  const reach = sum("reach"), ti = sum("totalInteractions");
  const totals: MetricTotals = {
    posts: posts.length,
    reach, impressions: sum("impressions"),
    likes: num(mx.likes_count?.total) ?? sum("likes"),
    comments: sum("comments"), shares: sum("shares"), saved: sum("saved"),
    profileVisits: sum("profileVisits"), follows: sum("follows"),
    webClicks: null, accountsEngaged: null, replies: null, reposts: null,
    totalInteractions: ti, erReach: reach && ti ? ti / reach : null,
  };
  return {
    connected: true, provider: "zernio", platform: "tiktok", period,
    account: { id: accountId, username: acct?.username ?? null, followers: num(mx.follower_count?.total), platform: "tiktok" },
    posts, totals, reels: computeReels(posts),
    followersGained: num(mx.followers_gained?.total), followersLost: num(mx.followers_lost?.total),
    fetchedAt: new Date().toISOString(),
  };
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

  // Detect platform from the account; TikTok has its own pipeline.
  const accts = await listZernioAccounts(apiKey!).catch(() => ({ ok: false, accounts: [] as ZernioAccount[] }));
  const acct = accts.accounts.find((a) => a.id === accountId) ?? accts.accounts[0];
  const platform = (acct?.platform ?? "instagram").toLowerCase();
  if (platform === "tiktok") {
    return fetchTikTok(base, apiKey!, accountId, since, until, period, acct);
  }

  try {
    // Core totals first (fail → not-connected with the real reason).
    const core = await getJson(insightsUrl({}));
    const totals = metricsToTotals((core.metrics ?? {}) as Record<string, unknown>);

    // Everything else best-effort in parallel (a failure just omits that section).
    const settle = <T>(p: Promise<T>): Promise<T | null> => p.then((x) => x).catch(() => null);
    const range = `${since ? `&since=${since}` : ""}${until ? `&until=${until}` : ""}`;
    const bd = (metrics: string, breakdown: string) =>
      `${base}/v1/analytics/instagram/account-insights?accountId=${accountId}&metrics=${metrics}&metricType=total_value&breakdown=${breakdown}${range}`;
    // follower-history is limited to an 88-day window by Zernio → clamp `since`.
    const fhSince = (() => {
      if (!since || !until) return since;
      const days = (Date.parse(until) - Date.parse(since)) / 864e5;
      return days > 88 ? new Date(Date.parse(until) - 88 * 864e5).toISOString().slice(0, 10) : since;
    })();
    const fhRange = `${fhSince ? `&since=${fhSince}` : ""}${until ? `&until=${until}` : ""}`;
    const fhUrl = `${base}/v1/analytics/instagram/follower-history?accountId=${accountId}&metrics=follower_count,followers_gained,followers_lost&metricType=time_series${fhRange}`;
    const demo = (metric: string) =>
      `${base}/v1/analytics/instagram/demographics?accountId=${accountId}&metric=${metric}&breakdown=age,city,country,gender`;
    const [ctJson, ftJson, cbJson, tsJson, fhJson, demoJson, engDemoJson, storiesData, postsJson] = await Promise.all([
      settle(getJson(bd("reach,total_interactions", "media_product_type"))),
      settle(getJson(bd("reach", "follow_type"))),
      settle(getJson(bd("profile_links_taps", "contact_button_type"))),
      settle(getJson(insightsUrl({ metrics: "reach", metricType: "time_series" }))), // only reach supports time_series
      settle(getJson(fhUrl)),
      settle(getJson(demo("follower_demographics"))),
      settle(getJson(demo("engaged_audience_demographics"))),
      settle(fetchStories(base, apiKey!, accountId)),
      settle(getJson(`${base}/v1/analytics?platform=instagram&accountId=${accountId}&limit=50`)),
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

    // audience demographics (age / gender / city / country) — follower + engaged
    const parseDemo = (j: Record<string, unknown> | null) => {
      const d = (j?.demographics ?? null) as Record<string, Record<string, unknown>[]> | null;
      if (!d) return null;
      const conv = (arr?: Record<string, unknown>[]) =>
        (arr ?? []).map((x) => ({ name: String(x.dimension ?? x.name), value: num(x.value) ?? 0 })).filter((x) => x.value > 0);
      const out = { ages: conv(d.age), genders: conv(d.gender), cities: conv(d.city).slice(0, 6), countries: conv(d.country).slice(0, 6) };
      return out.ages.length || out.genders.length || out.cities.length || out.countries.length ? out : null;
    };
    const demographics = parseDemo(demoJson);
    const engagedDemographics = parseDemo(engDemoJson);

    // impressions come from the unified overview (not account-insights)
    const overview = (postsJson?.overview ?? {}) as Record<string, unknown>;
    const ovImpr = num(overview.totalImpressions);
    if (ovImpr != null) totals.impressions = ovImpr;

    // per-post analytics (shared mapper) + reels summary
    const posts = mapPosts(postsJson);
    totals.posts = posts.length;
    const reels = computeReels(posts);

    // Zernio has no account-level impressions/profile-visits → sum per-post.
    const sumPost = (k: keyof PostMetric) => {
      const v = posts.map((p) => p[k]).filter((x): x is number => typeof x === "number");
      return v.length ? v.reduce((a, b) => a + b, 0) : null;
    };
    if (totals.impressions == null) totals.impressions = sumPost("impressions");
    if (totals.profileVisits == null) totals.profileVisits = sumPost("profileVisits");

    // "Followers on this period": day-to-day follower count mapped onto each post's
    // date (Zernio snapshots followers daily from the connect date forward). For
    // dates before Zernio began snapshotting, fall back to the current count.
    const fsSorted = (followerSeries ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const currentFollowers = latestFollowers ?? acct?.followers ?? null;
    const followerOn = (date: string): number | null => {
      if (!date || !fsSorted.length) return null;
      let best: number | null = null;
      for (const p of fsSorted) {
        if (p.date <= date) best = p.value;
        else break;
      }
      return best ?? fsSorted[0].value;
    };
    for (const p of posts) p.followersAtPeriod = followerOn(p.date) ?? currentFollowers;

    const dr = (core.dateRange ?? {}) as Record<string, unknown>;
    return {
      connected: true,
      provider: "zernio",
      platform: "instagram",
      period: dr.since && dr.until ? `${dr.since} → ${dr.until}` : period,
      account: {
        id: accountId,
        username: acct?.username ?? acct?.displayName ?? null,
        followers: latestFollowers ?? acct?.followers ?? null,
        platform: acct?.platform ?? "instagram",
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
      engagedDemographics,
      reels,
      stories: (storiesData as ReportMetrics["stories"]) ?? null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    return { connected: false, provider: "zernio", posts: [], reason: `Zernio API ${(e as Error).message}` };
  }
}
