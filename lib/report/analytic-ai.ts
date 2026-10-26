import "server-only";
import type { ReportMetrics } from "@/lib/report/types";
import { efficiency, postHasData, qualityScore } from "@/lib/report/derive";

/* ─────────────────────── Health Score ─────────────────────── */

export type SubScore = {
  label: string;
  score: number;
  max: number;
  bench: string;
  value: string;
  tip: string | null;
};

export type HealthScore = {
  total: number;
  grade: "A" | "B" | "C" | "D" | "F";
  label: string;
  /** Which semantic colour the score wears (ok / warn / bad); the view maps it to a design token, so no hex lives here. */
  tone: "ok" | "warn" | "bad";
  subScores: SubScore[];
};

export function computeHealthScore(metrics: ReportMetrics): HealthScore | null {
  if (!metrics.connected) return null;

  const posts = metrics.posts ?? [];
  const t = metrics.totals;
  // No reach and no post with insights means there is nothing to score: grading zeros would call "no data" a "critical" account.
  if (!((t?.reach ?? 0) > 0) && !posts.some(postHasData)) return null;
  const followers = metrics.account?.followers ?? null;
  const eff = efficiency(t, followers, posts);
  const cqs = qualityScore(posts) ?? 0;
  const gained = metrics.followersGained ?? 0;
  const lost = metrics.followersLost ?? 0;
  const netGrowth = gained - lost;
  const growthPct = followers && followers > 0 ? netGrowth / followers : 0;

  const rr = eff.reachRate ?? 0;
  const er = eff.erReach ?? 0;

  const reachScore =
    rr >= 0.08 ? 30 : rr >= 0.06 ? 24 : rr >= 0.04 ? 18 : rr >= 0.02 ? 10 : 4;
  const engagementScore =
    er >= 0.03 ? 25 : er >= 0.02 ? 20 : er >= 0.01 ? 14 : er >= 0.005 ? 8 : 3;
  const qualScore =
    cqs >= 5 ? 25 : cqs >= 4 ? 22 : cqs >= 2 ? 16 : cqs >= 1 ? 10 : 4;
  const growthScore =
    netGrowth < 0 ? 0 : growthPct >= 0.01 ? 20 : growthPct >= 0.005 ? 15 : netGrowth > 0 ? 10 : 4;

  const total = reachScore + engagementScore + qualScore + growthScore;
  const grade: "A" | "B" | "C" | "D" | "F" =
    total >= 85 ? "A" : total >= 70 ? "B" : total >= 55 ? "C" : total >= 40 ? "D" : "F";
  const label =
    total >= 85 ? "Excellent" : total >= 70 ? "Good" : total >= 55 ? "Fair" : total >= 40 ? "Perlu Perbaikan" : "Kritis";
  const tone = total >= 70 ? "ok" : total >= 55 ? "warn" : "bad";

  const fmt = (v: number | null, pct = false) =>
    v == null ? "—" : pct ? (v * 100).toFixed(1) + "%" : v.toFixed(1);

  return {
    total,
    grade,
    label,
    tone,
    subScores: [
      {
        label: "Reach Rate",
        score: reachScore,
        max: 30,
        bench: "≥8%",
        value: fmt(eff.reachRate, true),
        tip: rr < 0.04 ? "Tingkatkan frekuensi & pakai hashtag niche yang relevan." : null,
      },
      {
        label: "Engagement Rate",
        score: engagementScore,
        max: 25,
        bench: "≥3%",
        value: fmt(eff.erReach, true),
        tip: er < 0.01 ? "Tambahkan CTA eksplisit: tanya, polling, atau ajak simpan." : null,
      },
      {
        label: "Kualitas Konten",
        score: qualScore,
        max: 25,
        bench: "CQS ≥5",
        value: `CQS ${cqs.toFixed(1)}`,
        tip: cqs < 2 ? "Prioritaskan konten edukatif yang mendorong save & share." : null,
      },
      {
        label: "Pertumbuhan Follower",
        score: growthScore,
        max: 20,
        bench: "Net +1%/bln",
        value: `+${gained} / -${lost}`,
        tip: netGrowth <= 0 ? "Kolaborasi & giveaway untuk mendatangkan follower baru." : null,
      },
    ],
  };
}

/* ─────────────────────── AI helpers ─────────────────────── */

// In-process result cache: keyed by a hash of the compact data payload.
// Prevents duplicate Anthropic calls when the Analytic tab is re-navigated
// within the same serverless instance.  TTL 24h, max 500 entries per cache.
const CACHE_TTL = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
type CacheEntry<T> = { v: T; at: number };
function _makeCache<T>() { return new Map<string, CacheEntry<T>>(); }
function _get<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.at > CACHE_TTL) { cache.delete(key); return null; }
  return e.v;
}
function _set<T>(cache: Map<string, CacheEntry<T>>, key: string, v: T) {
  if (cache.size >= CACHE_MAX) {
    const old = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (old) cache.delete(old[0]);
  }
  cache.set(key, { v, at: Date.now() });
}
// Simple djb2-based hash of a JSON payload — good enough as a cache key.
function _hashKey(data: unknown): string {
  const s = JSON.stringify(data);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const _tipCache = _makeCache<CMOTip[]>();
const _researchCache = _makeCache<ResearchCard[]>();

function extractHashtags(caption: string): string[] {
  return [...caption.matchAll(/#([a-zA-Z0-9_]{2,50})/g)]
    .map((m) => m[1].toLowerCase())
    .filter((t, i, a) => a.indexOf(t) === i)
    .slice(0, 10);
}

function compact(m: ReportMetrics) {
  const posts = m.posts ?? [];
  // Aggregate hashtag frequency across all posts so the AI can identify keyword patterns.
  const tagFreq: Record<string, number> = {};
  for (const p of posts) {
    for (const t of extractHashtags(p.caption ?? "")) tagFreq[t] = (tagFreq[t] ?? 0) + 1;
  }
  const topHashtags = Object.entries(tagFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tag, count]) => ({ tag, count }));

  return {
    platform: m.platform,
    period: m.period,
    followers: m.account?.followers,
    postCount: posts.length,
    reach: m.totals?.reach,
    likes: m.totals?.likes,
    comments: m.totals?.comments,
    saved: m.totals?.saved,
    shares: m.totals?.shares,
    followersGained: m.followersGained,
    followersLost: m.followersLost,
    byContentType: m.byContentType,
    topHashtags,
    topPosts: posts
      .slice()
      .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))
      .slice(0, 5)
      .map((p) => ({
        // 200 chars — long enough to capture hashtag blocks at caption end
        caption: (p.caption ?? "").slice(0, 200),
        hashtags: extractHashtags(p.caption ?? ""),
        reach: p.reach,
        saved: p.saved,
        shares: p.shares,
      })),
  };
}

// MODEL STRATEGY:
//  Haiku  — fast & cheap, for repetitive structured output (CMO tips).
//  Sonnet — balanced, for nuanced analytical cards (SEO/GEO/Social research).
//  Opus   — reserved for one-off complex generation (engine audit in lib/engine).
async function callClaude<T>(
  apiKey: string,
  system: string,
  user: string,
  fallback: T,
  opts: { model: string; maxTokens: number },
): Promise<T> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) return fallback;
    const j = (await res.json()) as { content?: { text?: string }[] };
    const out = (j.content ?? []).map((b) => b.text ?? "").join("");
    const match = out.match(/\[[\s\S]*\]/);
    return JSON.parse(match ? match[0] : out) as T;
  } catch {
    return fallback;
  }
}

/* ─────────────────────── CMO Tips ─────────────────────── */

export type CMOTip = { emoji: string; title: string; body: string };

export async function generateCMOTips(
  apiKey: string | null,
  metrics: ReportMetrics,
): Promise<CMOTip[]> {
  if (!apiKey || !metrics.connected) return [];
  const payload = compact(metrics);
  const cacheKey = _hashKey(payload);
  const cached = _get(_tipCache, cacheKey);
  if (cached) return cached;
  const system =
    "Anda CMO senior & digital marketing strategist berpengalaman. " +
    "Berdasar data laporan sosial media, buat TEPAT 5 tips & tricks yang KONKRET, ACTIONABLE, " +
    "merujuk langsung ke angka/data yang ada. Jangan mengarang data. " +
    "Jika data tidak mencukupi untuk sebuah tips, tulis 'Data belum cukup.' pada field body. " +
    "Bahasa Indonesia. " +
    'Balas HANYA JSON array valid: [{"emoji":"<1 emoji>","title":"<judul max 6 kata>","body":"<satu kalimat aksi dgn angka spesifik>"}]. Tanpa teks lain.';
  const user = `DATA:\n${JSON.stringify(payload)}\n\nBuat 5 tips CMO + digital marketing.`;
  const result = await callClaude<CMOTip[]>(apiKey, system, user, [], {
    model: "claude-haiku-5-5",
    maxTokens: 600,
  });
  if (result.length) _set(_tipCache, cacheKey, result);
  return result;
}

/* ─────────────────────── SEO/GEO/Social Research ─────────────────────── */

export type ResearchCard = {
  category: "SEO" | "GEO" | "Social Search";
  insight: string;
  action: string;
};

export async function generateResearch(
  apiKey: string | null,
  metrics: ReportMetrics,
): Promise<ResearchCard[]> {
  if (!apiKey || !metrics.connected) return [];
  const payload = compact(metrics);
  const cacheKey = _hashKey(payload);
  const cached = _get(_researchCache, cacheKey);
  if (cached) return cached;

  // GEO insight is only meaningful when there is a real content library (≥3 months or ≥20 posts).
  // For smaller accounts, a third Social Search card is more actionable.
  const posts = metrics.posts ?? [];
  const hasContentDepth = posts.length >= 20;

  const cardSpec = hasContentDepth
    ? "1 SEO, 1 GEO, 2 Social Search"
    : "1 SEO, 3 Social Search (platform yang berbeda jika data tersedia)";
  const geoNote = hasContentDepth
    ? "1 GEO (Generative Engine Optimization — agar dikutip ChatGPT/Gemini/Perplexity). "
    : "";

  const system =
    "Anda SEO/GEO/social search strategist senior untuk agensi digital marketing di Indonesia. " +
    `Berdasar data akun sosial, buat TEPAT 4 insight: ${cardSpec}. ` +
    "1 SEO (bagaimana konten sosial ini bisa muncul di organic search Google). " +
    geoNote +
    "Social Search: optimasi agar konten ditemukan lewat search TikTok, IG Explore, atau YouTube. " +
    "Setiap insight HARUS merujuk angka atau pola spesifik dari data (reach, saved, hashtag, dsb). " +
    "Jika data tidak cukup untuk sebuah kategori, tulis insight: 'Data belum cukup untuk ini.' " +
    "Hindari saran generik tanpa angka. Bahasa Indonesia. " +
    'Balas HANYA JSON array: [{"category":"SEO"|"GEO"|"Social Search","insight":"<temuan 1-2 kalimat berbasis data>","action":"<rekomendasi konkret 1 kalimat dengan angka>"}]. Tanpa teks lain.';
  const user = `DATA:\n${JSON.stringify(payload)}\n\nBuat 4 research insights.`;
  const result = await callClaude<ResearchCard[]>(apiKey, system, user, [], {
    model: "claude-sonnet-5-5",
    maxTokens: 900,
  });
  if (result.length) _set(_researchCache, cacheKey, result);
  return result;
}
