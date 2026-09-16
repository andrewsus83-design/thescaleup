import "server-only";
import type { ReportMetrics, ReportCustomParam, PostMetric } from "@/lib/report/types";

/**
 * AI-suggest an editorial "Pillar" for each post (Cap Gajah-style). Classification,
 * not fabrication: the model labels each caption with a short, consistent pillar.
 * Mutates posts in place (sets `pillar`); best-effort — no key / failure → left null.
 */
export async function suggestPillars(apiKey: string | null, posts: PostMetric[]): Promise<void> {
  if (!apiKey || !posts.length) return;
  const items = posts.map((p, i) => ({ i, format: p.format, caption: (p.caption ?? "").slice(0, 160) }));
  const system =
    "Anda content strategist. Untuk tiap post, beri SATU 'pillar' konten yang ringkas (1-3 kata) " +
    "berdasarkan caption + format. Gunakan set pillar yang KONSISTEN di seluruh post (mis. " +
    "Entertainment, Edukasi, Product Highlight, Storytelling, Promo, Lifestyle, Behind The Scenes). " +
    "Jika format video/reels dan tak ada tema kuat, boleh 'Video'. JANGAN mengarang isi caption. " +
    'Balas HANYA JSON array valid: [{"i":<index>,"pillar":"<pillar>"}]. Tanpa teks lain.';
  const user = `POSTS:\n${JSON.stringify(items)}`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-opus-5", max_tokens: 1200, system, messages: [{ role: "user", content: user }] }),
      cache: "no-store",
    });
    if (!res.ok) return;
    const j = (await res.json()) as { content?: { text?: string }[] };
    const out = (j.content ?? []).map((b) => b.text ?? "").join("");
    const match = out.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(match ? match[0] : out) as { i: number; pillar: string }[];
    for (const r of Array.isArray(parsed) ? parsed : []) {
      if (typeof r.i === "number" && posts[r.i] && typeof r.pillar === "string") {
        posts[r.i].pillar = r.pillar.trim().slice(0, 40) || null;
      }
    }
  } catch {
    /* best-effort — leave pillars null */
  }
}

/** Compact, data-only view of the report for the model (no fabrication room). */
function compact(m: ReportMetrics) {
  const topPosts = (m.posts ?? [])
    .slice()
    .sort((a, b) => (b.totalInteractions ?? 0) - (a.totalInteractions ?? 0))
    .slice(0, 8)
    .map((p) => ({
      date: p.date,
      caption: (p.caption ?? "").slice(0, 90),
      reach: p.reach,
      likes: p.likes,
      comments: p.comments,
      saved: p.saved,
      shares: p.shares,
      er: p.engagementRate,
    }));
  return {
    platform: m.platform,
    period: m.period,
    account: m.account,
    totals: m.totals,
    discovery: m.discovery,
    byContentType: m.byContentType,
    followers: { gained: m.followersGained, lost: m.followersLost },
    demographics: m.demographics,
    engagedDemographics: m.engagedDemographics,
    reels: m.reels,
    stories: m.stories ? { count: m.stories.count, views: m.stories.views, reach: m.stories.reach, replies: m.stories.replies } : null,
    postCount: m.posts?.length ?? 0,
    topPosts,
  };
}

/**
 * Analyze report data against custom parameters using Claude Opus.
 * Anti-fabrication: the model is told to use only the provided data and to say
 * "Data belum cukup" when a parameter can't be answered from it.
 */
export async function analyzeReportWithClaude(
  apiKey: string | null,
  metrics: ReportMetrics,
  params: ReportCustomParam[],
): Promise<{ label: string; type: string; text: string }[] | null> {
  if (!apiKey || !params.length || !metrics.connected) return null;
  const data = compact(metrics);
  const list = params.map((p, i) => `${i + 1}. [id:${p.id}] tipe=${p.type} — "${p.label}": ${p.prompt || "(analisa umum)"}`).join("\n");
  const system =
    "Anda analis media sosial / CMO senior. Analisa DATA laporan (JSON) untuk setiap parameter. " +
    "Tulis ringkas (2-4 kalimat), konkret, actionable, Bahasa Indonesia, dan HANYA berdasar data yang diberikan. " +
    "JANGAN mengarang angka atau fakta. Jika data tidak cukup untuk sebuah parameter, tulis persis: \"Data belum cukup untuk ini.\" " +
    'Balas HANYA JSON array valid: [{"id":"<id>","text":"<analisa>"}]. Tanpa teks lain.';
  const user = `DATA LAPORAN:\n${JSON.stringify(data)}\n\nPARAMETER YANG DIMINTA:\n${list}`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-opus-5", max_tokens: 2500, system, messages: [{ role: "user", content: user }] }),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 140);
      return params.map((p) => ({ label: p.label, type: p.type, text: `Analisa AI gagal (${res.status}). ${body}` }));
    }
    const j = (await res.json()) as { content?: { text?: string }[] };
    const out = (j.content ?? []).map((b) => b.text ?? "").join("");
    let parsed: { id: string; text: string }[] = [];
    const match = out.match(/\[[\s\S]*\]/);
    try {
      parsed = JSON.parse(match ? match[0] : out);
    } catch {
      parsed = [];
    }
    return params.map((p) => ({
      label: p.label,
      type: p.type,
      text: parsed.find((x) => x.id === p.id)?.text ?? "Data belum cukup untuk ini.",
    }));
  } catch (e) {
    return params.map((p) => ({ label: p.label, type: p.type, text: `Analisa AI error: ${(e as Error).message}` }));
  }
}
