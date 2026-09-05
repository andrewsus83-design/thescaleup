import "server-only";
import { getApiKeys } from "./keys";
import { fetchSiteText, type SiteData } from "./fetch-site";
import { perplexityGeoCheck } from "./geo";
import { callLLM } from "./llm";

export type AuditResult = {
  ok: boolean;
  error?: string;
  title?: string;
  summary?: string;
  content?: Record<string, unknown>;
};

const SYSTEM_PROMPT = `Anda adalah "Virtual Executive Board" dari ScaleUp: gabungan CMO, CBO (Chief Business Officer), CTO, dan Creative Lead, diverifikasi oleh Red Team. Anda menganalisis sebuah bisnis dari DATA NYATA yang diberikan (isi website, website kompetitor, dan cek AI Search bila ada).

Aturan:
- Jawab HANYA dengan satu objek JSON valid — tanpa teks lain, tanpa markdown fence.
- Semua analisis dalam Bahasa Indonesia, tajam, spesifik ke bisnis ini (rujuk apa yang benar-benar terlihat di datanya). Hindari saran generik.
- Skor 0–100 harus beralasan berdasarkan bukti. Jika data terbatas, tetap beri estimasi wajar dan sebutkan asumsinya di temuan.
- Estimasi omzet dalam Rupiah, realistis untuk skala bisnis yang terlihat.
- Fokus pada: apa yang HILANG/bocor, dan pengungkit omzet konkret.

Skema JSON yang WAJIB diikuti:
{
  "scores": { "overall": int, "cro": int, "geo": int, "social": int, "tech": int },
  "summary": "2-3 kalimat ringkasan eksekutif untuk pemilik bisnis",
  "whats_missing": ["kebocoran/celah konkret", "...", "...", "..."],
  "revenue_booster": {
    "current_estimate": "Rp ... / bulan (perkiraan)",
    "projected": "Rp ... / bulan",
    "uplift": "+X%",
    "levers": ["pengungkit konkret + estimasi dampak", "...", "..."]
  },
  "executive": {
    "cmo": { "summary": "...", "actions": ["...", "..."] },
    "cbo": { "summary": "...", "actions": ["...", "..."] },
    "cto": { "summary": "...", "actions": ["...", "..."] },
    "creative": { "summary": "...", "actions": ["...", "..."] }
  },
  "roadmap": {
    "phase_1": ["Quick win 0-14 hari", "..."],
    "phase_2": ["Growth 15-45 hari", "..."],
    "phase_3": ["Custom/infra 45+ hari", "..."]
  }
}`;

function siteBlock(label: string, s: SiteData | null): string {
  if (!s) return `${label}: (tidak diberikan)`;
  if (!s.ok) return `${label}: (gagal diambil — ${s.error})`;
  return `${label} [${s.url}]
Judul: ${s.title || "-"}
Meta: ${s.description || "-"}
Isi (terpotong): ${s.text || "-"}`;
}

function buildUserPrompt(
  m: Record<string, unknown>,
  business: string,
  site: SiteData | null,
  comp1: SiteData | null,
  comp2: SiteData | null,
  geo: string | null,
): string {
  return `Analisis bisnis berikut dan hasilkan report sesuai skema JSON.

# Profil Bisnis
Nama: ${business}
Kategori/Model: ${m.category ?? "-"}
Goal utama: ${m.goal ?? "-"}
Budget marketing/bulan: ${m.budget ?? "-"}
Bottleneck utama (menurut klien): ${m.bottleneck ?? "-"}
Instagram: ${m.instagram ?? "-"} | TikTok/lainnya: ${m.tiktok ?? "-"}

# Data Website Klien
${siteBlock("Website klien", site)}

# Data Kompetitor
${siteBlock("Kompetitor 1", comp1)}
${siteBlock("Kompetitor 2", comp2)}

# Cek AI Search (GEO)
${geo ? geo : "(tidak dijalankan — tidak ada API key Perplexity)"}

Ingat: keluarkan HANYA JSON sesuai skema.`;
}

function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Run the real audit for a member and return a saveable report. */
export async function runAudit(m: Record<string, unknown>): Promise<AuditResult> {
  const keys = await getApiKeys();
  if (!keys.claude && !keys.openai && !keys.gemini) {
    return { ok: false, error: "NO_LLM_KEY" };
  }

  const business =
    (m.business as string) || (m.name as string) || "Bisnis";

  // 1. Gather real data (website + competitors) in parallel.
  const [site, comp1, comp2] = await Promise.all([
    m.website ? fetchSiteText(m.website as string) : Promise.resolve(null),
    m.competitor1 ? fetchSiteText(m.competitor1 as string) : Promise.resolve(null),
    m.competitor2 ? fetchSiteText(m.competitor2 as string) : Promise.resolve(null),
  ]);

  // 2. Optional GEO check.
  let geo: string | null = null;
  if (keys.perplexity) {
    geo = await perplexityGeoCheck(
      keys.perplexity,
      business,
      (m.category as string) || "produk/jasa di kategorinya",
    );
  }

  // 3. LLM analysis.
  const system = SYSTEM_PROMPT;
  const user = buildUserPrompt(m, business, site, comp1, comp2, geo);
  let llm;
  try {
    llm = await callLLM(keys, system, user);
  } catch (e) {
    const err = e as { message?: string };
    if (err?.message === "NO_LLM_KEY") return { ok: false, error: "NO_LLM_KEY" };
    return { ok: false, error: `LLM error: ${err?.message ?? "unknown"}` };
  }

  const parsed = extractJson(llm.text);
  if (!parsed) {
    return { ok: false, error: "AI tidak mengembalikan JSON yang valid." };
  }

  const scores = (parsed.scores as Record<string, number>) ?? {};
  const whatsMissing = (parsed.whats_missing as string[]) ?? [];

  const content: Record<string, unknown> = {
    generated: "engine",
    engine: { provider: llm.provider, model: llm.model },
    data_sources: {
      website: site?.ok ? "scraped" : site ? `failed: ${site.error}` : "none",
      competitors: [comp1, comp2].filter((c) => c?.ok).length,
      geo_checked: !!geo,
    },
    context: {
      business,
      website: m.website ?? null,
      category: m.category ?? null,
      goal: m.goal ?? null,
      budget: m.budget ?? null,
      bottleneck: m.bottleneck ?? null,
      instagram: m.instagram ?? null,
      tiktok: m.tiktok ?? null,
      competitors: [m.competitor1, m.competitor2].filter(Boolean),
    },
    geo_raw: geo,
    ...parsed,
  };

  return {
    ok: true,
    title: `Audit ScaleUp — ${business}`,
    summary:
      (parsed.summary as string) ||
      `Skor keseluruhan ${scores.overall ?? "-"}/100. ${whatsMissing[0] ?? ""}`,
    content,
  };
}
