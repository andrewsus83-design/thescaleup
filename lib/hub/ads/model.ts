// Pure rules for Ads: reading what Zernio returns, filters, totals and the rule-based suggestions. No I/O.
// Zernio does not document every field of an ad's `metrics`, so each number is read from the names it is likely to have and stays
// null (shown as "—") when none is there. Nothing here invents a number.

import { addDays, isIsoDate, monthKey, shiftMonth } from "../tasks/dates";

export type AdStatus = "active" | "review" | "scheduled" | "paused" | "rejected" | "ended" | "other";
export const STATUS_LABEL: Record<AdStatus, string> = { active: "Running", review: "In review", scheduled: "Scheduled", paused: "Paused", rejected: "Rejected", ended: "Ended", other: "Other" };
export const STATUS_TONE: Record<AdStatus, "ok" | "info" | "warn" | "bad" | "neutral"> = { active: "ok", review: "info", scheduled: "info", paused: "warn", rejected: "bad", ended: "neutral", other: "neutral" };
/** Shown on the Active page; everything else is History. */
export const isLive = (s: AdStatus) => s === "active" || s === "review" || s === "scheduled";

const PLATFORM_LABEL: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", google: "Google", linkedin: "LinkedIn", pinterest: "Pinterest", twitter: "X", reddit: "Reddit", openai: "ChatGPT", microsoft: "Microsoft" };
export const platformLabel = (p: string) => PLATFORM_LABEL[p] ?? (p ? p[0].toUpperCase() + p.slice(1) : "Other");

export type AdRow = {
  id: string;
  name: string;
  campaign: string | null;
  platform: string;
  status: AdStatus;
  rawStatus: string;
  reason: string | null;
  kind: "boost" | "standalone" | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  results: number | null;
  currency: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string | null;
  headline: string | null;
  /** Ids of the post this ad promotes, as the platform names them. */
  postRefs: string[];
};

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
const first = <T>(...vals: (T | null | undefined)[]): T | null => vals.find((v) => v !== null && v !== undefined) ?? null;

/** Maps the platform's own words to one of ours. The raw word stays on the row so nothing is hidden when it does not fit. */
export function normalizeStatus(status: unknown, review: unknown): AdStatus {
  const t = String(status ?? "").toLowerCase();
  const r = String(review ?? "").toLowerCase();
  if (/reject|disapprov|denied/.test(r) || /reject|disapprov|denied/.test(t)) return "rejected";
  if (/inactive|paus|disable|stopp|suspend|off\b/.test(t)) return "paused";
  if (/archiv|delet|cancel|complet|ended|expired|closed|finish|removed/.test(t)) return "ended";
  if (/schedul|upcoming|not_started/.test(t)) return "scheduled";
  if (/pending|in_review|review|processing|in_process|draft/.test(t) || /pending|in_review|in_process/.test(r)) return "review";
  if (/active|enable|deliver|running|live|learning/.test(t)) return "active";
  return "other";
}

/** One ad from Zernio's list. Returns null when it has no id to tell it apart by. */
export function parseAd(raw: unknown): AdRow | null {
  if (!isRec(raw)) return null;
  const id = first(str(raw._id), str(raw.id), str(raw.platformAdId));
  if (!id) return null;
  const m = isRec(raw.metrics) ? raw.metrics : {};
  const budget = isRec(raw.budget) ? raw.budget : {};
  const creative = isRec(raw.creative) ? raw.creative : {};
  const schedule = isRec(raw.schedule) ? raw.schedule : {};
  const spend = num(first(m.spend, m.cost, m.amountSpent));
  const impressions = num(m.impressions);
  const clicks = num(first(m.clicks, m.linkClicks));
  const ctr = num(m.ctr) ?? (clicks !== null && impressions ? (clicks / impressions) * 100 : null);
  const cpc = num(m.cpc) ?? (spend !== null && clicks ? spend / clicks : null);
  const refs = [raw.effectiveObjectStoryId, raw.effectiveInstagramMediaId, raw.postId, creative.effectiveObjectStoryId, creative.effectiveInstagramMediaId, creative.postId].map(str).filter((x): x is string => x !== null);
  const kind = raw.adType === "boost" || raw.adType === "standalone" ? raw.adType : null;
  return {
    id,
    name: first(str(raw.name), str(creative.headline), str(raw.campaignName)) ?? "Untitled ad",
    campaign: str(raw.campaignName),
    platform: (str(raw.platform) ?? "other").toLowerCase(),
    status: normalizeStatus(raw.status, raw.reviewStatus),
    rawStatus: str(raw.status) ?? "",
    reason: str(raw.rejectionReason),
    kind,
    spend,
    impressions,
    clicks,
    ctr,
    cpc,
    results: num(first(m.conversions, m.results)),
    currency: first(str(raw.currency), str(m.currency), str(budget.currency)),
    startsAt: first(str(schedule.startTime), str(schedule.startsAt), str(schedule.start), str(schedule.startDate)),
    endsAt: first(str(schedule.endTime), str(schedule.endsAt), str(schedule.end), str(schedule.endDate)),
    createdAt: first(str(raw.platformCreatedAt), str(raw.createdAt)),
    headline: str(creative.headline),
    postRefs: [...new Set(refs)],
  };
}

/** True when none of the ads came back with a number we recognise: the page says so instead of showing a wall of dashes. */
export const noNumbers = (ads: readonly AdRow[]) => ads.length > 0 && ads.every((a) => a.spend === null && a.impressions === null && a.clicks === null);

// ---------------------------------------------------------------------------------------------- date range

export type Range = { from: string; to: string; preset: string | null };
export const PRESETS: { id: string; label: string }[] = [
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
  { id: "mtd", label: "This month" },
  { id: "last", label: "Last month" },
  { id: "90", label: "90 days" },
];

export function presetRange(id: string, today: string): Range | null {
  switch (id) {
    case "7": return { from: addDays(today, -6), to: today, preset: id };
    case "30": return { from: addDays(today, -29), to: today, preset: id };
    case "90": return { from: addDays(today, -89), to: today, preset: id };
    case "mtd": return { from: `${monthKey(today)}-01`, to: today, preset: id };
    case "last": return { from: `${shiftMonth(monthKey(today), -1)}-01`, to: addDays(`${monthKey(today)}-01`, -1), preset: id };
    default: return null;
  }
}

/** The range from the address bar: two valid days (at most 730 apart), else a preset, else the last 30 days. */
export function parseRange(get: (k: string) => string, today: string): Range {
  const from = get("from");
  const to = get("to");
  if (isIsoDate(from) && isIsoDate(to) && from <= to && to <= today && Date.parse(to) - Date.parse(from) <= 730 * 86_400_000) return { from, to, preset: null };
  return presetRange(get("r"), today) ?? presetRange("30", today)!;
}

// ---------------------------------------------------------------------------------------------- filters

export const SORTS = ["spend", "newest", "results", "cpc"] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABEL: Record<Sort, string> = { spend: "Most spent", newest: "Newest", results: "Most clicks", cpc: "Cheapest clicks" };
export type Filters = { platform?: string; min?: number; max?: number; sort: Sort };

const amount = (v: string): number | undefined => {
  const n = Number(v.replace(/,/g, "").trim());
  return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function parseFilters(get: (k: string) => string, fallbackSort: Sort): Filters {
  const p = get("p").toLowerCase();
  const sort = get("sort");
  return { platform: /^[a-z]{2,20}$/.test(p) ? p : undefined, min: amount(get("min")), max: amount(get("max")), sort: (SORTS as readonly string[]).includes(sort) ? (sort as Sort) : fallbackSort };
}

export function filterAds(ads: readonly AdRow[], f: Filters): AdRow[] {
  const out = ads.filter((a) => {
    if (f.platform && a.platform !== f.platform) return false;
    if (f.min !== undefined && (a.spend ?? 0) < f.min) return false;
    if (f.max !== undefined && (a.spend ?? 0) > f.max) return false;
    return true;
  });
  const t = (a: AdRow) => Date.parse(a.startsAt ?? a.createdAt ?? "") || 0;
  const by: Record<Sort, (a: AdRow, b: AdRow) => number> = {
    spend: (a, b) => (b.spend ?? -1) - (a.spend ?? -1),
    newest: (a, b) => t(b) - t(a),
    results: (a, b) => (b.clicks ?? -1) - (a.clicks ?? -1),
    cpc: (a, b) => (a.cpc ?? Infinity) - (b.cpc ?? Infinity),
  };
  return out.sort(by[f.sort]);
}

/** Whether an ad delivered at all in the range: History leaves out ads that never ran then. */
export const delivered = (a: AdRow) => (a.spend ?? 0) > 0 || (a.impressions ?? 0) > 0;

// ---------------------------------------------------------------------------------------------- totals and formatting

export type Total = { currency: string | null; ads: number; spend: number; impressions: number; clicks: number; results: number; ctr: number | null; cpc: number | null };

/** Sums per currency: two currencies are never added together. */
export function totals(ads: readonly AdRow[]): Total[] {
  const by = new Map<string, Total>();
  for (const a of ads) {
    const k = a.currency ?? "";
    const t = by.get(k) ?? { currency: a.currency, ads: 0, spend: 0, impressions: 0, clicks: 0, results: 0, ctr: null, cpc: null };
    t.ads += 1;
    t.spend += a.spend ?? 0;
    t.impressions += a.impressions ?? 0;
    t.clicks += a.clicks ?? 0;
    t.results += a.results ?? 0;
    by.set(k, t);
  }
  return [...by.values()]
    .map((t) => ({ ...t, ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : null, cpc: t.clicks > 0 ? t.spend / t.clicks : null }))
    .sort((a, b) => b.spend - a.spend);
}

export function money(n: number | null, currency: string | null): string {
  if (n === null) return "—";
  const digits = Math.abs(n) >= 100 ? 0 : 2;
  if (currency) {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
    } catch {
      return `${currency} ${n.toLocaleString("en-US", { maximumFractionDigits: digits })}`;
    }
  }
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}
export const count = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-US", { notation: n >= 100_000 ? "compact" : "standard", maximumFractionDigits: 1 }));
export const pct = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`);

// ---------------------------------------------------------------------------------------------- suggestions

export type Suggestion = { id: string; tone: "bad" | "warn" | "ok"; title: string; why: string; adName: string; platform: string };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Plain rules over the numbers, so a suggestion always shows what it rests on. They only point at an ad; nothing here changes one. */
export function suggest(ads: readonly AdRow[]): Suggestion[] {
  const out: Suggestion[] = [];
  const live = ads.filter((a) => a.status === "active");

  for (const a of ads.filter((x) => x.status === "rejected")) {
    out.push({ id: `rej-${a.id}`, tone: "bad", title: "Fix a rejected ad", why: a.reason ?? "The platform rejected it. Open it in the ad account to see why.", adName: a.name, platform: a.platform });
  }
  for (const a of live) {
    if ((a.impressions ?? 0) >= 1000 && a.clicks === 0 && (a.spend ?? 0) > 0) {
      out.push({ id: `waste-${a.id}`, tone: "warn", title: "Stop or change this ad", why: `Shown ${count(a.impressions)} times with no clicks. Spent ${money(a.spend, a.currency)}.`, adName: a.name, platform: a.platform });
    }
  }
  // Cost per click is only compared between ads on the same platform and in the same currency, with enough clicks to mean something.
  const groups = new Map<string, AdRow[]>();
  for (const a of live) if (a.cpc !== null && (a.clicks ?? 0) >= 20) groups.set(`${a.platform}|${a.currency ?? ""}`, [...(groups.get(`${a.platform}|${a.currency ?? ""}`) ?? []), a]);
  const costly: Suggestion[] = [];
  const cheap: Suggestion[] = [];
  for (const g of groups.values()) {
    if (g.length < 3) continue;
    const med = median(g.map((a) => a.cpc as number));
    if (!(med > 0)) continue;
    for (const a of g) {
      const ratio = (a.cpc as number) / med;
      if (ratio >= 1.5) costly.push({ id: `cost-${a.id}`, tone: "warn", title: "Clicks cost a lot here", why: `${money(a.cpc, a.currency)} a click, ${ratio.toFixed(1)}× the usual ${money(med, a.currency)} on ${platformLabel(a.platform)}.`, adName: a.name, platform: a.platform });
      else if (ratio <= 0.7) cheap.push({ id: `best-${a.id}`, tone: "ok", title: "Worth more budget", why: `${money(a.cpc, a.currency)} a click, ${(1 / ratio).toFixed(1)}× cheaper than the usual ${money(med, a.currency)} on ${platformLabel(a.platform)}.`, adName: a.name, platform: a.platform });
    }
  }
  return [...out, ...costly, ...cheap].slice(0, 15);
}

// ---------------------------------------------------------------------------------------------- posts that could be boosted

export type PostRow = { id: string; text: string; platform: string; at: string | null; url: string | null; interactions: number; reach: number | null; refs: string[] };

export function parsePost(raw: unknown): PostRow | null {
  if (!isRec(raw)) return null;
  const pa = Array.isArray(raw.platformAnalytics) ? raw.platformAnalytics.filter(isRec) : [];
  const a = isRec(raw.analytics) ? raw.analytics : isRec(pa[0]?.analytics) ? (pa[0].analytics as Rec) : {};
  const id = first(str(raw._id), str(raw.postId), str(raw.id), str(pa[0]?.platformPostId));
  if (!id) return null;
  const parts = [a.likes, a.comments, a.shares, a.saves].map(num);
  const interactions = parts.some((x) => x !== null) ? parts.reduce<number>((s, x) => s + (x ?? 0), 0) : 0;
  const refs = [raw.platformPostId, ...pa.map((p) => p.platformPostId)].map(str).filter((x): x is string => x !== null);
  return {
    id,
    text: (str(raw.content) ?? "").replace(/\s+/g, " ").slice(0, 160),
    platform: (first(str(raw.platform), str(pa[0]?.platform)) ?? "").toLowerCase(),
    at: first(str(raw.publishedAt), str(raw.scheduledFor)),
    url: first(str(raw.platformPostUrl), str(pa[0]?.platformPostUrl)),
    interactions,
    reach: num(first(a.reach, a.views, a.impressions)),
    refs,
  };
}

/** The best-liked posts that no running or past ad already promotes. */
export function boostCandidates(posts: readonly PostRow[], ads: readonly AdRow[], limit = 8): PostRow[] {
  const used = new Set(ads.flatMap((a) => a.postRefs));
  const promoted = (p: PostRow) => p.refs.some((r) => used.has(r) || [...used].some((u) => u.endsWith(`_${r}`) || r.endsWith(`_${u}`)));
  return posts.filter((p) => p.interactions > 0 && !promoted(p)).sort((a, b) => b.interactions - a.interactions).slice(0, limit);
}
