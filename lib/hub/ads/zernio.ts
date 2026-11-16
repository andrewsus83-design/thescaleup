import "server-only";
import { getBrandKey } from "../secrets";
import { parseAd, parsePost, type AdRow, type PostRow } from "./model";

// Reads from Zernio for the Ads menu, with the brand's own Zernio key (never the agency's). Read-only: nothing here creates, changes
// or pays for an ad. Docs: docs.zernio.com (Campaigns and Ads, Posting Analytics).

const base = () => ((process.env.ZERNIO_BASE_URL ?? "").trim() || "https://zernio.com/api").replace(/\/$/, "");

/** Why the Ads page has nothing to show, in terms the person can act on. */
export type Problem = { kind: "no-key" | "auth" | "plan" | "reconnect" | "busy" | "error"; message: string };
export type AdsResult = { ok: true; ads: AdRow[]; backfill: boolean; more: boolean } | { ok: false; problem: Problem };

const PAGE = 50;
const MAX_PAGES = 4; // 200 ads: enough for one brand; the page says when there are more
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: AdsResult }>();

function problemFor(status: number, body: string): Problem {
  if (status === 401) return { kind: "auth", message: "Zernio did not accept this brand's key. Paste it again in Settings, Social media connections." };
  if (status === 403) return { kind: "plan", message: "Zernio says this key has no access to Ads. Plans before usage-based pricing need the Ads add-on in Zernio." };
  if (status === 409) return { kind: "reconnect", message: "An ad account needs to be reconnected in Zernio before its ads can be read." };
  if (status === 429) {
    const wait = Number(/"retryAfterSeconds"\s*:\s*(\d+)/.exec(body)?.[1]);
    return { kind: "busy", message: `Zernio is limiting requests right now. Try again${Number.isFinite(wait) && wait > 0 ? ` in about ${wait} seconds` : " in a minute"}.` };
  }
  return { kind: "error", message: `Zernio answered with an error (${status}). Try again in a moment.` };
}

/** Ads of the brand with their numbers for the range, both days included. Cached for a minute per brand and range. */
export async function loadAds(brandId: string, from: string, to: string): Promise<AdsResult> {
  const hit = cache.get(`${brandId}|${from}|${to}`);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const key = await getBrandKey(brandId, "zernio", false);
  if (!key) return { ok: false, problem: { kind: "no-key", message: "This brand has no Zernio key yet." } };

  const ads: AdRow[] = [];
  let backfill = false;
  let more = false;
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const qs = new URLSearchParams({ fromDate: from, toDate: to, limit: String(PAGE), page: String(page) });
      const res = await fetch(`${base()}/v1/ads?${qs}`, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (res.status !== 200 && res.status !== 202) {
        const body = await res.text().catch(() => "");
        console.error("[ads] zernio", res.status, body.slice(0, 200).replace(/\s+/g, " "));
        return { ok: false, problem: problemFor(res.status, body) };
      }
      const j = (await res.json()) as { ads?: unknown[]; pagination?: { pages?: number }; backfillPending?: boolean };
      if (j.backfillPending || res.status === 202) backfill = true;
      for (const raw of Array.isArray(j.ads) ? j.ads : []) {
        const ad = parseAd(raw);
        if (ad) ads.push(ad);
      }
      const pages = Number(j.pagination?.pages) || 1;
      if (page >= pages) break;
      if (page === MAX_PAGES) more = true;
    }
  } catch (e) {
    console.error("[ads] zernio call failed:", e instanceof Error ? e.message : e);
    return { ok: false, problem: { kind: "error", message: "Could not reach Zernio. Try again in a moment." } };
  }
  const value: AdsResult = { ok: true, ads, backfill, more };
  // A 202 means Zernio is still importing history: do not keep that answer.
  if (!backfill) cache.set(`${brandId}|${from}|${to}`, { at: Date.now(), value });
  return value;
}

/** Organic posts of the range with their engagement, newest first as Zernio returns them. null when they could not be read. */
export async function loadPosts(brandId: string, from: string, to: string): Promise<PostRow[] | null> {
  const key = await getBrandKey(brandId, "zernio", false);
  if (!key) return null;
  try {
    const qs = new URLSearchParams({ fromDate: from, toDate: to, limit: "100", page: "1" });
    const res = await fetch(`${base()}/v1/analytics?${qs}`, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      console.error("[ads] zernio posts", res.status);
      return null;
    }
    const j = (await res.json()) as { posts?: unknown[] };
    return (Array.isArray(j.posts) ? j.posts : []).map(parsePost).filter((p): p is PostRow => p !== null);
  } catch (e) {
    console.error("[ads] zernio posts failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
