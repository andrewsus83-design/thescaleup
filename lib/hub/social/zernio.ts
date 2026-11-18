import "server-only";
import type { Problem } from "../ads/zernio";
import { parsePost, type PostRow } from "../ads/model";
import { brandScope } from "../zernio/api";
import { parseDaily, previousWindow, type Daily, type Window } from "./model";

// Reads from Zernio for the Social Media page: the agency's one key, always limited to this brand's own profile. Read-only.
// Docs: docs.zernio.com (Posting Analytics: GET /v1/analytics/daily-metrics and GET /v1/analytics).

const base = () => ((process.env.ZERNIO_BASE_URL ?? "").trim() || "https://zernio.com/api").replace(/\/$/, "");
const TTL_MS = 60_000;

export type SocialResult = { ok: true; cur: Daily; prev: Daily | null; posts: PostRow[] | null } | { ok: false; problem: Problem };
const cache = new Map<string, { at: number; value: SocialResult }>();

function problemFor(status: number, body: string): Problem {
  if (status === 401) return { kind: "auth", message: "Zernio did not accept the agency's key. The agency owner can check it in the workspace settings." };
  if (status === 402 || status === 403) return { kind: "plan", message: "Zernio says this key has no analytics access. Plans before usage-based pricing need the Analytics add-on in Zernio." };
  if (status === 429) {
    const wait = Number(/"retryAfterSeconds"\s*:\s*(\d+)/.exec(body)?.[1]);
    return { kind: "busy", message: `Zernio is limiting requests right now. Try again${Number.isFinite(wait) && wait > 0 ? ` in about ${wait} seconds` : " in a minute"}.` };
  }
  return { kind: "error", message: `Zernio answered with an error (${status}). Try again in a moment.` };
}

type Fetched = { ok: true; json: unknown } | { ok: false; status: number; body: string } | { ok: false; status: 0; body: "" };

async function get(key: string, path: string, qs: URLSearchParams): Promise<Fetched> {
  try {
    const res = await fetch(`${base()}${path}?${qs}`, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { ok: false, status: res.status, body: (await res.text().catch(() => "")).slice(0, 300) };
    return { ok: true, json: await res.json().catch(() => null) };
  } catch (e) {
    console.error("[social] zernio call failed:", path, e instanceof Error ? e.message : e);
    return { ok: false, status: 0, body: "" };
  }
}

const daily = (key: string, profileId: string, w: Window, platform?: string) => get(key, "/v1/analytics/daily-metrics", new URLSearchParams({ profileId, fromDate: w.from, toDate: w.to, ...(platform ? { platform } : {}) }));

/**
 * The days and platforms of the window, the same length before it for comparison, and the posts of the window (for the best ones).
 * Cached for a minute per brand, window and platform. The posts and the comparison are optional: if only they fail, the page still shows.
 */
export async function loadSocial(brandId: string, w: Window, platform?: string): Promise<SocialResult> {
  const ck = `${brandId}|${w.from}|${w.to}|${platform ?? ""}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const scope = await brandScope(brandId);
  if (!scope.ok) return { ok: false, problem: scope.problem };
  const { key, profileId } = scope;

  const [cur, prev, posts] = await Promise.all([
    daily(key, profileId, w, platform),
    daily(key, profileId, previousWindow(w), platform),
    get(key, "/v1/analytics", new URLSearchParams({ profileId, fromDate: w.from, toDate: w.to, limit: "100", page: "1", ...(platform ? { platform } : {}) })),
  ]);
  if (!cur.ok) {
    if (cur.status) console.error("[social] zernio daily-metrics", cur.status, cur.body.replace(/\s+/g, " "));
    return { ok: false, problem: cur.status ? problemFor(cur.status, cur.body) : { kind: "error", message: "Could not reach Zernio. Try again in a moment." } };
  }
  const curParsed = parseDaily(cur.json);
  if (!curParsed) return { ok: false, problem: { kind: "error", message: "Zernio answered, but not in a shape this page understands. Try again in a moment." } };
  const value: SocialResult = {
    ok: true,
    cur: curParsed,
    prev: prev.ok ? parseDaily(prev.json) : null,
    posts: posts.ok && posts.json && typeof posts.json === "object" ? (Array.isArray((posts.json as { posts?: unknown[] }).posts) ? ((posts.json as { posts: unknown[] }).posts.map(parsePost).filter((p): p is PostRow => p !== null)) : []) : null,
  };
  cache.set(ck, { at: Date.now(), value });
  return value;
}
