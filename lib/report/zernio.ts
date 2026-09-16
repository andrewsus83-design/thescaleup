import "server-only";
import type { PostMetric, ReportMetrics, MetricTotals } from "@/lib/report/types";

/**
 * Zernio adapter — the per-client data source that REPLACES Apify on the
 * report platform. Each client connects their OWN Zernio account, so we call
 * Zernio with that client's key.
 *
 * Zernio's exact REST shape is configured, not hard-coded, so it can be wired
 * without touching callers:
 *   - Base URL:  env ZERNIO_BASE_URL  (e.g. https://api.zernio.com)
 *   - Auth:      Bearer <client key>
 *   - Endpoint:  GET {base}/v1/accounts/{accountId}/insights?period={period}
 *
 * HARD RULE (matches the rest of ScaleUp): never fabricate. If Zernio is not
 * configured / the key is missing / the call fails, return {connected:false}
 * with a reason — the UI then shows a "not connected" state, not fake numbers.
 */

function zernioBaseUrl(): string | null {
  const b = (process.env.ZERNIO_BASE_URL ?? "").trim();
  return b ? b.replace(/\/$/, "") : null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Map a Zernio media object to our normalized PostMetric (defensive to field naming). */
function toPost(m: Record<string, unknown>): PostMetric {
  const g = (...keys: string[]) => {
    for (const k of keys) if (m[k] !== undefined && m[k] !== null) return m[k];
    return undefined;
  };
  const likes = num(g("likes", "likeCount", "like_count"));
  const comments = num(g("comments", "commentCount", "comment_count"));
  const shares = num(g("shares", "shareCount", "share_count"));
  const saved = num(g("saved", "saves", "saveCount", "save_count"));
  const follows = num(g("follows", "followsFromPost", "follows_from_post"));
  const profileVisits = num(g("profileVisits", "profile_visits"));
  const webClicks = num(g("webClicks", "web_clicks", "linkClicks", "link_clicks"));
  const total =
    num(g("totalInteractions", "total_interactions")) ??
    ([likes, comments, shares, saved, follows, profileVisits, webClicks].some((x) => x !== null)
      ? (likes ?? 0) + (comments ?? 0) + (shares ?? 0) + (saved ?? 0) + (follows ?? 0) + (profileVisits ?? 0) + (webClicks ?? 0)
      : null);
  const typ = String(g("format", "mediaType", "media_type", "type") ?? "").toLowerCase();
  const format = /reel|video/.test(typ) ? "Reels / Video" : /carousel|sidecar|album/.test(typ) ? "Carousel" : "Image";
  return {
    date: String(g("date", "timestamp", "publishedAt", "published_at") ?? "").slice(0, 10),
    caption: String(g("caption", "text", "title") ?? "").replace(/\s+/g, " ").trim(),
    format,
    reach: num(g("reach")),
    impressions: num(g("impressions", "views_total")),
    likes,
    comments,
    shares,
    saved,
    profileVisits,
    follows,
    webClicks,
    views: num(g("views", "videoViews", "video_views", "plays")),
    totalInteractions: total,
    url: (g("url", "permalink", "link") as string) ?? null,
  };
}

function computeTotals(posts: PostMetric[]): MetricTotals {
  const sum = (k: keyof PostMetric) => {
    const vals = posts.map((p) => p[k]).filter((v): v is number => typeof v === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };
  const reach = sum("reach");
  const totalInteractions = sum("totalInteractions");
  return {
    posts: posts.length,
    reach,
    impressions: sum("impressions"),
    likes: sum("likes"),
    comments: sum("comments"),
    shares: sum("shares"),
    saved: sum("saved"),
    profileVisits: sum("profileVisits"),
    follows: sum("follows"),
    webClicks: sum("webClicks"),
    totalInteractions,
    erReach: reach && totalInteractions ? totalInteractions / reach : null,
  };
}

/**
 * Fetch normalized metrics for one client from Zernio. Never throws — returns a
 * not-connected ReportMetrics on any problem.
 */
export async function fetchZernioMetrics(opts: {
  apiKey: string | null;
  accountId: string | null;
  period?: string;
}): Promise<ReportMetrics> {
  const period = opts.period ?? "last_30d";
  const base = zernioBaseUrl();
  if (!opts.apiKey) {
    return { connected: false, provider: "zernio", posts: [], reason: "Client belum menghubungkan akun Zernio (API key kosong)." };
  }
  if (!base) {
    return {
      connected: false,
      provider: "zernio",
      posts: [],
      reason: "ZERNIO_BASE_URL belum dikonfigurasi di environment. Set dulu base URL API Zernio.",
    };
  }
  try {
    const acct = opts.accountId ? encodeURIComponent(opts.accountId) : "me";
    const url = `${base}/v1/accounts/${acct}/insights?period=${encodeURIComponent(period)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${opts.apiKey}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { connected: false, provider: "zernio", posts: [], reason: `Zernio API ${res.status}: ${body.slice(0, 160)}` };
    }
    const json = (await res.json()) as Record<string, unknown>;
    const rawPosts = (json.posts ?? json.media ?? json.data ?? []) as Record<string, unknown>[];
    const posts = Array.isArray(rawPosts) ? rawPosts.map(toPost).filter((p) => p.date) : [];
    const acctObj = (json.account ?? json.profile ?? {}) as Record<string, unknown>;
    return {
      connected: true,
      provider: "zernio",
      period,
      account: {
        username: (acctObj.username as string) ?? (acctObj.handle as string) ?? null,
        followers: num(acctObj.followers ?? acctObj.followersCount ?? acctObj.followers_count),
      },
      posts,
      totals: computeTotals(posts),
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      connected: false,
      provider: "zernio",
      posts: [],
      reason: `Gagal menghubungi Zernio: ${(e as Error).message}`,
    };
  }
}
