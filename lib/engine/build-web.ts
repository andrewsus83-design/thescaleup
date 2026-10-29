import "server-only";
import { getApiKeys } from "./keys";
import { fetchSiteText } from "./fetch-site";
import { callLLM } from "./llm";

// ─── Input / output types ─────────────────────────────────────────────────────

export type WebBuildInput = {
  businessName: string;
  category?: string;
  goal?: string;
  website?: string;
  instagram?: string;
  fonts: { title: string; body: string; mono: string; accent: string };
  colors: { primary: string; secondary: string; accent: string };
  style: string[];
  schema: string;
  whatsapp?: string;
  mapsUrl?: string;
  faqAuto?: boolean;
  faqItems?: { q: string; a: string }[];
  blogLabel?: string;
  refUrls?: string[];
};

export type WebBuildResult = { ok: true; html: string } | { ok: false; error: string };
export type WebEditResult  = { ok: true; html: string } | { ok: false; error: string };

// ─── Prompts ──────────────────────────────────────────────────────────────────

const DIRECTOR_SYSTEM = `Anda adalah Creative Director & UX Architect untuk website bisnis Indonesia.
Tugas Anda: analisis data brand dan (jika ada) konten referensi, lalu hasilkan SATU objek JSON sebagai blueprint halaman web.

Aturan:
- Jawab HANYA dengan JSON valid — tanpa teks lain, tanpa markdown fence.
- Semua copy dalam Bahasa Indonesia yang natural dan persuasif, kecuali brand jelas berbahasa Inggris.
- Buat copy yang SPESIFIK ke bisnis ini — hindari kalimat generik.
- Sesuaikan tone dengan style tags yang diberikan (minimal, bold, luxury, playful, dsb).

Skema JSON wajib:
{
  "creative_brief": "2–3 kalimat arahan estetika, tone, dan mood halaman",
  "seo": { "title": "...", "description": "..." },
  "nav": { "logo": "nama brand", "links": ["...", "..."] },
  "hero": { "headline": "...", "subline": "...", "cta": "..." },
  "sections": [
    { "id": "string", "type": "features|services|benefits|testimonials|process|portfolio|cta", "title": "...", "items": [...] }
  ],
  "faq": [{ "q": "...", "a": "..." }],
  "footer": { "tagline": "...", "address": "...", "links": ["..."] }
}

"sections[].items" bergantung pada type:
- features/benefits: [{ "icon": "emoji_1char", "title": "...", "body": "..." }] (3–5 item)
- services: [{ "title": "...", "price": "...", "body": "..." }] (2–4 item)
- testimonials: [{ "name": "...", "role": "...", "text": "..." }] (3 item, nama Indonesia)
- process: [{ "step": "01", "title": "...", "body": "..." }]
- portfolio: [{ "title": "...", "category": "...", "color": "#hex" }] (4–6 placeholder item)
- cta: { "headline": "...", "subline": "...", "button": "..." }`;

const BUILDER_SYSTEM = `Anda adalah senior frontend developer.
Anda menerima blueprint JSON sebuah halaman dan design tokens (font, warna).
Tugas: hasilkan SATU dokumen HTML lengkap dan self-contained.

Wajib:
- Output HANYA HTML — tidak ada teks lain, tidak ada markdown fence.
- Dokumen dimulai dengan <!DOCTYPE html> dan mengakhiri dengan </html>.
- Google Fonts dimuat via <link> di <head>.
- Warna brand sebagai CSS custom properties di :root.
- Desain RESPONSIF (mobile-first, breakpoint ≥768px untuk desktop).
- Navigasi: sticky top, logo kiri, links kanan (hamburger di mobile).
- Setiap section dari blueprint HARUS ada di halaman.
- Gambar/foto: gunakan div dengan background-color yang sesuai brand (JANGAN gunakan URL gambar eksternal).
- Animasi ringan: fade-in on scroll dengan IntersectionObserver.
- Tombol WhatsApp sticky (bawah kanan) jika nomor disediakan.
- Google Maps iframe jika URL disediakan.
- FAQ pakai <details>/<summary> untuk accordion tanpa JS.
- Footer lengkap: tagline, kontak, links.
- Kode bersih, semantic HTML5, accessible (alt text, aria).`;

const EDIT_SYSTEM = `Anda adalah senior frontend developer yang melakukan revisi halaman web.
Anda menerima HTML halaman saat ini dan instruksi perubahan dari klien.
Hasilkan SELURUH dokumen HTML yang sudah direvisi — jangan potong atau hilangkan bagian yang tidak berubah.
Output HANYA HTML — tidak ada teks lain, tidak ada markdown fence.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function refBlock(contents: string[]): string {
  if (!contents.length) return "(tidak ada referensi)";
  return contents
    .map((c, i) => `## Referensi ${i + 1}\n${c}`)
    .join("\n\n");
}

function designTokenBlock(input: WebBuildInput): string {
  return `Design Tokens:
- Font Title: "${input.fonts.title}"
- Font Body: "${input.fonts.body}"
- Font Mono: "${input.fonts.mono}"
- Font Accent: "${input.fonts.accent}"
- Warna Primary: ${input.colors.primary}
- Warna Secondary: ${input.colors.secondary}
- Warna Accent: ${input.colors.accent}
- Style: ${input.style.join(", ")}
- Schema: ${input.schema}`;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

/** Two-pass web page builder: Opus director → Sonnet builder. */
export async function runWebBuildEngine(
  input: WebBuildInput,
  brandDbId?: string,
): Promise<WebBuildResult> {
  const keys = await getApiKeys(brandDbId);
  if (!keys.claude && !keys.openai && !keys.gemini) {
    return { ok: false, error: "NO_LLM_KEY" };
  }

  // 1. Fetch reference sites in parallel.
  const refUrls = (input.refUrls ?? []).filter(Boolean).slice(0, 3);
  const refData = await Promise.all(refUrls.map((u) => fetchSiteText(u)));
  const refContents = refData
    .filter((r) => r?.ok)
    .map((r) => `${r!.url}\n${r!.title ?? ""}\n${r!.text ?? ""}`.slice(0, 800));

  // 2. Director pass — Opus generates the page spec.
  const directorUser = `
Bisnis: ${input.businessName}
Kategori: ${input.category ?? "-"}
Goal: ${input.goal ?? "-"}
Website: ${input.website ?? "-"}
Instagram: ${input.instagram ?? "-"}
${designTokenBlock(input)}
WhatsApp: ${input.whatsapp ?? "(tidak ada)"}
Google Maps: ${input.mapsUrl ? "ada" : "(tidak ada)"}
FAQ: ${input.faqAuto ? "auto-generate" : input.faqItems?.length ? `${input.faqItems.length} item manual` : "tidak aktif"}
Blog: ${input.blogLabel ?? "(tidak aktif)"}

Referensi website yang dianalisis:
${refBlock(refContents)}

Hasilkan blueprint JSON sesuai skema.`.trim();

  let specJson: string;
  try {
    const dirResult = await callLLM(keys, DIRECTOR_SYSTEM, directorUser, "claude-opus-5-5");
    specJson = dirResult.text;
  } catch (e) {
    const err = e as { message?: string };
    return { ok: false, error: `Director error: ${err.message ?? "unknown"}` };
  }

  // 3. Builder pass — Sonnet builds the HTML from the spec.
  const faqNote = input.faqAuto
    ? "FAQ: generate item yang relevan sesuai blueprint."
    : input.faqItems?.length
    ? `FAQ items manual: ${JSON.stringify(input.faqItems)}`
    : "FAQ: tidak aktif, jangan tampilkan section FAQ.";

  const builderUser = `
Blueprint JSON:
${specJson}

${designTokenBlock(input)}
${faqNote}
${input.whatsapp ? `WhatsApp sticky: ${input.whatsapp}` : "Tidak ada tombol WhatsApp."}
${input.mapsUrl ? `Google Maps iframe src: ${input.mapsUrl}` : "Tidak ada Google Maps."}
${input.blogLabel ? `Blog section label: "${input.blogLabel}" (tampilkan 3 placeholder card)` : "Tidak ada blog section."}

Bangun halaman web lengkap sesuai blueprint. Output HANYA HTML.`.trim();

  let html: string;
  try {
    const buildResult = await callLLM(keys, BUILDER_SYSTEM, builderUser, "claude-sonnet-5-5");
    html = extractHtml(buildResult.text);
  } catch (e) {
    const err = e as { message?: string };
    return { ok: false, error: `Builder error: ${err.message ?? "unknown"}` };
  }

  if (!html.includes("<!DOCTYPE") && !html.includes("<html")) {
    return { ok: false, error: "Builder tidak menghasilkan HTML yang valid." };
  }

  return { ok: true, html };
}

/** Single-pass edit: Sonnet revises the existing HTML based on a prompt. */
export async function runWebEditEngine(
  currentHtml: string,
  editPrompt: string,
  brandDbId?: string,
): Promise<WebEditResult> {
  const keys = await getApiKeys(brandDbId);
  if (!keys.claude && !keys.openai && !keys.gemini) {
    return { ok: false, error: "NO_LLM_KEY" };
  }

  const user = `HTML halaman saat ini:
\`\`\`html
${currentHtml}
\`\`\`

Instruksi perubahan dari klien:
${editPrompt}

Hasilkan seluruh HTML yang sudah direvisi.`;

  try {
    const result = await callLLM(keys, EDIT_SYSTEM, user, "claude-sonnet-5-5");
    const html = extractHtml(result.text);
    if (!html.includes("<html") && !html.includes("<!DOCTYPE")) {
      return { ok: false, error: "Revisi tidak menghasilkan HTML yang valid." };
    }
    return { ok: true, html };
  } catch (e) {
    const err = e as { message?: string };
    return { ok: false, error: `Edit error: ${err.message ?? "unknown"}` };
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function extractHtml(text: string): string {
  if (!text) return "";
  const t = text.trim();
  // Strip markdown fences if the LLM wrapped the output
  const fence = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  return t;
}
