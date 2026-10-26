// Guided intake for a new brand (docs 4 · "Starting a chat: choose a project or create a brand").
// One question at a time: name, website, handles, then — after the site is read — only the 5W gaps.
// At most MAX_QUESTIONS questions, never asks what the website already answers, and refuses a website
// another project already uses. Pure functions: the UI owns the conversation, this owns the rules.

import type { FieldKey, IntakeState, Lang, Profile, Project } from "./types";

export const FIVE_W: FieldKey[] = ["who", "what", "when", "where", "why"];
export const MAX_QUESTIONS = 7;
export const MAX_UNKNOWN = 2;

export const tr = (lang: Lang, en: string, id: string) => (lang === "id" ? id : en);

// ---------------------------------------------------------------- language
const ID_WORDS = new Set(
  "yang dan untuk saya kami dengan tidak ada apa siapa mengapa kapan bagaimana bisa tolong buat nama alamat toko usaha pelanggan laporan skor tugas belum sudah mau akan dari ke di ini itu bukan jual jualan makanan minuman bisnis anda kita mereka sedang masih juga atau karena agar supaya sebuah semua".split(" "),
);
/** The chat answers in the language of the message. Short answers (a brand name, a URL) keep the current one. */
export function detectLang(text: string, fallback: Lang = "en"): Lang {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  if (words.length < 3) return fallback;
  const hits = words.filter((w) => ID_WORDS.has(w)).length;
  if (hits >= 2 || hits / words.length >= 0.3) return "id";
  return hits === 0 ? "en" : fallback;
}

// ---------------------------------------------------------------- website
/** "https://www.KopiSenja.id/menu" → "kopisenja.id"; null when it is not a plausible address. */
export function normalizeSite(input: string): string | null {
  let s = input.trim().toLowerCase();
  s = s.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  s = s.split(/[/?#]/)[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : null;
}

// Stand-in for the real crawl (site + socials → extraction). Known demo domains get a plausible read;
// anything else gets a generic first draft that staff confirm or correct.
const SITE_READS: Record<string, Pick<Profile, "who" | "what">> = {
  "kopisenja.id": { who: "Office workers and students in Jakarta who want a slow, good cup in the afternoon", what: "Specialty coffee, whole beans and weekend brewing workshops" },
  "batiklaras.co.id": { who: "Women 28–45 buying work and ceremony wear", what: "Hand-stamped batik dresses and fabric by the metre" },
  "klinikprima.id": { who: "Families in South Jakarta", what: "Family clinic: check-ups, vaccinations and an in-house pharmacy" },
};
export function readSite(domain: string, brand: string): Pick<Profile, "who" | "what"> {
  return (
    SITE_READS[domain] ?? {
      who: `People looking for what ${brand} offers (read from the homepage)`,
      what: `The products and services ${brand} lists on ${domain}`,
    }
  );
}

// ---------------------------------------------------------------- state
export function startIntake(): IntakeState {
  return { step: "brand", profile: {}, sources: {}, asked: 0, siteRead: false };
}

function prefillFromSite(s: IntakeState): IntakeState {
  const read = readSite(s.profile.website ?? "", s.profile.brand ?? "the brand");
  const profile = { ...s.profile };
  const sources = { ...s.sources };
  for (const f of ["who", "what"] as const) {
    if (!profile[f] && read[f]) {
      profile[f] = read[f];
      sources[f] = "website";
    }
  }
  return { ...s, profile, sources, siteRead: true };
}

/** Work out which question comes next from what is filled in. */
function advance(s: IntakeState): IntakeState {
  const p = s.profile;
  if (!p.brand) return { ...s, step: "brand", current: undefined };
  if (!p.website) return { ...s, step: "website", current: undefined };
  if (!p.handles?.length && !p.noAccounts) return { ...s, step: "handles", current: undefined };
  const gap = FIVE_W.find((f) => !p[f] && s.sources[f] !== "unknown");
  if (gap && s.asked < MAX_QUESTIONS) return { ...s, step: "gaps", current: gap };
  return { ...s, step: "confirm", current: undefined };
}

/** Resume an unfinished intake (a draft project) where it stopped. */
export function resumeIntake(p: Project): IntakeState {
  const asked =
    (["brand", "website", "handles"] as FieldKey[]).filter((f) => p.sources[f] === "answered").length +
    FIVE_W.filter((f) => p.sources[f] === "answered" || p.sources[f] === "unknown").length;
  let s: IntakeState = { step: "brand", profile: { ...p.profile }, sources: { ...p.sources }, asked, siteRead: false, draftId: p.id };
  if (s.profile.brand && s.profile.website && (s.profile.handles?.length || s.profile.noAccounts)) s = prefillFromSite(s);
  return advance(s);
}

export function unknownCount(s: IntakeState): number {
  return FIVE_W.filter((f) => s.sources[f] === "unknown").length;
}

const NONE = /^(none|no accounts?|no social( media)?|n\/a|tidak ada|belum ada|gak ada|nggak ada)\.?$/i;
const UNKNOWN = /^(unknown|don'?t know|not sure|skip|-|tidak tahu|belum tahu|gak tahu|nggak tahu)\.?$/i;

export function parseHandles(text: string): string[] {
  const out: string[] = [];
  // Split only on commas, semicolons and newlines — not on spaces — so a handle with dots inside
  // (sweet.and.sour) stays whole, and free-text sentences ("we mostly use instagram") are not
  // tokenised into fake handles. Spaces are only split when the token starts with @ or is a URL.
  for (const raw of text.split(/[,;\n]+/)) {
    let t = raw.trim();
    if (!t) continue;
    const url = /(?:instagram|tiktok|facebook|x|twitter)\.com\/@?([a-z0-9._]+)/i.exec(t);
    if (url) {
      // Social URL: extract the username part.
      const handle = url[1].replace(/^@+/, "");
      if (/^[a-z0-9._]{2,30}$/i.test(handle)) out.push(`@${handle}`);
    } else {
      // Non-URL token: only accept it if it starts with @ (an explicit handle), or if the whole
      // token matches the handle pattern AND contains no spaces (avoids treating words as handles).
      const stripped = t.replace(/^@+/, "");
      if (t.startsWith("@") && /^[a-z0-9._]{2,30}$/i.test(stripped)) {
        out.push(`@${stripped}`);
      }
    }
  }
  return [...new Set(out)].slice(0, 6);
}

export type AnswerResult = {
  state: IntakeState;
  error?: string;
  /** Set when the website already belongs to another project. */
  conflict?: Project;
  /** True when this answer triggered the website + socials read (the UI shows a short "reading…" beat). */
  justRead?: boolean;
};

function setWebsite(s: IntakeState, text: string, projects: Project[], lang: Lang): AnswerResult {
  const domain = normalizeSite(text);
  if (!domain) {
    return { state: s, error: tr(lang, "That doesn't look like a website address — try something like kopisenja.id.", "Itu belum terlihat seperti alamat website — coba seperti kopisenja.id.") };
  }
  const conflict = projects.find((p) => p.id !== s.draftId && normalizeSite(p.website) === domain);
  if (conflict) {
    return { state: s, conflict, error: tr(lang, `That website already belongs to “${conflict.name}”.`, `Website itu sudah dipakai “${conflict.name}”.`) };
  }
  return { state: { ...s, profile: { ...s.profile, website: domain }, sources: { ...s.sources, website: "answered" } } };
}

function setHandles(s: IntakeState, text: string, lang: Lang): AnswerResult {
  if (NONE.test(text.trim())) {
    return { state: { ...s, profile: { ...s.profile, handles: [], noAccounts: true }, sources: { ...s.sources, handles: "answered" } } };
  }
  const handles = parseHandles(text);
  if (!handles.length) {
    return { state: s, error: tr(lang, "I couldn't find a handle — write it like @kopisenja, or say “no accounts”.", "Saya tidak menemukan akun — tulis seperti @kopisenja, atau jawab “tidak ada”.") };
  }
  return { state: { ...s, profile: { ...s.profile, handles, noAccounts: false }, sources: { ...s.sources, handles: "answered" } } };
}

function setFiveW(s: IntakeState, f: FieldKey, text: string, lang: Lang): AnswerResult {
  if (UNKNOWN.test(text.trim())) {
    if (s.sources[f] !== "unknown" && unknownCount(s) >= MAX_UNKNOWN) {
      return { state: s, error: tr(lang, `At most ${MAX_UNKNOWN} of the 5W can be “unknown” — please answer this one.`, `Maksimal ${MAX_UNKNOWN} dari 5W boleh “tidak tahu” — tolong jawab yang ini.`) };
    }
    const profile = { ...s.profile };
    delete profile[f as "who"];
    return { state: { ...s, profile, sources: { ...s.sources, [f]: "unknown" } } };
  }
  return { state: { ...s, profile: { ...s.profile, [f]: text.trim() }, sources: { ...s.sources, [f]: "answered" } } };
}

/** Apply one typed answer to the current question. */
export function answer(s: IntakeState, raw: string, projects: Project[], lang: Lang): AnswerResult {
  const text = raw.trim();
  if (!text) return { state: s, error: tr(lang, "Type an answer first.", "Ketik jawabannya dulu.") };
  const bump = (r: AnswerResult): AnswerResult => (r.error ? r : { ...r, state: { ...r.state, asked: r.state.asked + 1 } });

  switch (s.step) {
    case "brand": {
      if (text.length < 2 || text.length > 60) return { state: s, error: tr(lang, "The brand name should be 2–60 characters.", "Nama brand sebaiknya 2–60 karakter.") };
      const r = bump({ state: { ...s, profile: { ...s.profile, brand: text }, sources: { ...s.sources, brand: "answered" } } });
      return { ...r, state: advance(r.state) };
    }
    case "website": {
      const r = bump(setWebsite(s, text, projects, lang));
      return r.error ? r : { ...r, state: advance(r.state) };
    }
    case "handles": {
      const r = bump(setHandles(s, text, lang));
      if (r.error) return r;
      // With name, website and handles the bot reads the site and socials, then only asks about the gaps.
      return { state: advance(prefillFromSite(r.state)), justRead: true };
    }
    case "gaps": {
      const f = s.current;
      if (!f) return { state: advance(s) };
      const r = bump(setFiveW(s, f, text, lang));
      return r.error ? r : { ...r, state: advance(r.state) };
    }
    case "confirm":
      return { state: s, error: tr(lang, "Use the buttons below, or tap a field on the card to edit it.", "Pakai tombol di bawah, atau ketuk kolom di kartu untuk mengubahnya.") };
  }
}

/** Edit one field from the confirmation card. Does not consume a question. */
export function editField(s: IntakeState, field: FieldKey, value: string, projects: Project[], lang: Lang): AnswerResult {
  const text = value.trim();
  if (!text) return { state: s, error: tr(lang, "A field can't be empty — say “unknown” for a 5W you can't answer.", "Kolom tidak boleh kosong — tulis “tidak tahu” untuk 5W yang belum bisa dijawab.") };
  let r: AnswerResult;
  if (field === "brand") r = text.length < 2 || text.length > 60 ? { state: s, error: tr(lang, "The brand name should be 2–60 characters.", "Nama brand sebaiknya 2–60 karakter.") } : { state: { ...s, profile: { ...s.profile, brand: text }, sources: { ...s.sources, brand: "answered" } } };
  else if (field === "website") r = setWebsite(s, text, projects, lang);
  else if (field === "handles") r = setHandles(s, text, lang);
  else r = setFiveW(s, field, text, lang);
  return r.error ? r : { ...r, state: advance({ ...r.state, step: "confirm" }) };
}

export function missingFields(s: IntakeState): FieldKey[] {
  const p = s.profile;
  const out: FieldKey[] = [];
  if (!p.brand) out.push("brand");
  if (!p.website) out.push("website");
  if (!p.handles?.length && !p.noAccounts) out.push("handles");
  for (const f of FIVE_W) if (!p[f] && s.sources[f] !== "unknown") out.push(f);
  return out;
}

/** The rule table from the doc, as pass/fail rows for the live card. */
export function checklist(s: IntakeState, lang: Lang) {
  const p = s.profile;
  const filled = FIVE_W.filter((f) => !!p[f]).length;
  const unknown = unknownCount(s);
  return [
    { key: "brand", label: tr(lang, "Brand name", "Nama brand"), ok: !!p.brand, note: tr(lang, "Required", "Wajib") },
    { key: "website", label: "Website", ok: !!p.website, note: tr(lang, "Required · not used by another project", "Wajib · belum dipakai project lain") },
    { key: "handles", label: tr(lang, "Social media handles", "Akun media sosial"), ok: !!p.handles?.length || !!p.noAccounts, note: tr(lang, "One handle, or “no accounts”", "Satu akun, atau “tidak ada”") },
    { key: "5w", label: "Who · What · When · Where · Why", ok: filled + unknown === 5 && unknown <= MAX_UNKNOWN, note: tr(lang, `${filled}/5 answered · ${unknown} unknown (max ${MAX_UNKNOWN})`, `${filled}/5 terjawab · ${unknown} tidak tahu (maks ${MAX_UNKNOWN})`) },
    { key: "docs", label: tr(lang, "Documents", "Dokumen"), ok: true, note: tr(lang, "Optional — add any time", "Opsional — bisa kapan saja") },
  ];
}

export function canCreate(s: IntakeState): boolean {
  return missingFields(s).length === 0 && unknownCount(s) <= MAX_UNKNOWN;
}

function slug(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "brand";
}

/** Turn the intake into a project row — "draft" while unfinished, "active" once the staff confirm. */
export function toProject(s: IntakeState, projects: Project[], status: "active" | "draft"): Project {
  const name = s.profile.brand ?? "Untitled brand";
  let id = s.draftId ?? slug(name);
  if (!s.draftId) {
    const taken = new Set(projects.map((p) => p.id));
    let n = 2;
    const base = id;
    while (taken.has(id)) id = `${base}-${n++}`;
  }
  return {
    id,
    name,
    website: s.profile.website ?? "",
    status,
    profile: s.profile,
    sources: s.sources,
    locked: false,
    profileVersion: null,
    score: null,
    lastActivity: "Just now",
  };
}

// ---------------------------------------------------------------- copy
const GAP_Q: Record<string, Record<Lang, string>> = {
  who: { en: "Who is this brand for? Describe the ideal customer.", id: "Brand ini untuk siapa? Gambarkan pelanggan idealnya." },
  what: { en: "What does the brand sell or do?", id: "Apa yang dijual atau dikerjakan brand ini?" },
  when: { en: "When do customers buy or need it? Seasons, days, moments.", id: "Kapan pelanggan membeli atau membutuhkannya? Musim, hari, momen." },
  where: { en: "Where does it operate? City, region or online only.", id: "Di mana brand ini beroperasi? Kota, wilayah, atau online saja." },
  why: { en: "Why do customers choose it over the alternatives?", id: "Mengapa pelanggan memilih brand ini dibanding yang lain?" },
};

export function question(s: IntakeState, lang: Lang): string {
  switch (s.step) {
    case "brand":
      return tr(lang, "What's the brand name?", "Siapa nama brand-nya?");
    case "website":
      return tr(lang, "What's the website? For example kopisenja.id", "Apa alamat website-nya? Misalnya kopisenja.id");
    case "handles":
      return tr(lang, "Which social media handles does the brand use? List them, or say “no accounts”.", "Akun media sosial apa yang dipakai brand? Sebutkan, atau jawab “tidak ada”.");
    case "gaps":
      return GAP_Q[s.current ?? "who"][lang];
    case "confirm":
      return tr(lang, "That's everything I need. Check the card, then create the brand.", "Itu semua yang saya butuhkan. Cek kartunya, lalu buat brand-nya.");
  }
}

export function readingNote(s: IntakeState, lang: Lang): string {
  const found = (["who", "what"] as const).filter((f) => s.sources[f] === "website").length;
  return tr(
    lang,
    `I read ${s.profile.website} and the socials and pre-filled ${found} field${found === 1 ? "" : "s"} (marked “found on website”). I'll only ask about the gaps.`,
    `Saya membaca ${s.profile.website} dan media sosialnya, lalu mengisi ${found} kolom (ditandai “ditemukan di website”). Saya hanya akan menanyakan yang masih kosong.`,
  );
}
