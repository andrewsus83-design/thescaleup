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

function compact(m: ReportMetrics) {
  const posts = m.posts ?? [];
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
    topPosts: posts
      .slice()
      .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))
      .slice(0, 5)
      .map((p) => ({
        caption: (p.caption ?? "").slice(0, 80),
        reach: p.reach,
        saved: p.saved,
        shares: p.shares,
      })),
  };
}

async function callClaude<T>(
  apiKey: string,
  system: string,
  user: string,
  fallback: T,
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
        model: "claude-opus-5",
        max_tokens: 1500,
        system,
        messages: [{ role: "user", content: user }],
      }),
      cache: "no-store",
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
  const system =
    "Anda CMO senior & digital marketing strategist berpengalaman. " +
    "Berdasar data laporan sosial media, buat TEPAT 5 tips & tricks yang KONKRET, ACTIONABLE, " +
    "merujuk langsung ke angka/data yang ada. Jangan mengarang data. Bahasa Indonesia. " +
    'Balas HANYA JSON array valid: [{"emoji":"<1 emoji>","title":"<judul max 6 kata>","body":"<satu kalimat aksi dgn angka spesifik>"}]. Tanpa teks lain.';
  const user = `DATA:\n${JSON.stringify(compact(metrics))}\n\nBuat 5 tips CMO + digital marketing.`;
  return callClaude<CMOTip[]>(apiKey, system, user, []);
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
  const system =
    "Anda SEO/GEO/social search strategist senior. Berdasar data akun sosial, buat TEPAT 4 insight: " +
    "1 SEO (konten sosial → organic search Google), " +
    "1 GEO (Generative Engine Optimization — dikutip ChatGPT/Gemini/Perplexity), " +
    "2 Social Search (optimasi ditemukan via search TikTok/IG/YouTube). " +
    "Bahasa Indonesia. Setiap insight berbasis data yang diberikan. " +
    'Balas HANYA JSON array: [{"category":"SEO"|"GEO"|"Social Search","insight":"<temuan 1 kalimat>","action":"<rekomendasi 1 kalimat>"}]. Tanpa teks lain.';
  const user = `DATA:\n${JSON.stringify(compact(metrics))}\n\nBuat 4 research insights.`;
  return callClaude<ResearchCard[]>(apiKey, system, user, []);
}
