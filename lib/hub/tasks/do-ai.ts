// "Do with AI" on a task: the kinds of help, the limits, and the checks on what comes back. No I/O and no server-only imports, so the
// task page, the browser and tests can all use it.
//
// Stateless on purpose. Nothing about a chat is stored. Every request rebuilds what the AI needs from the brand's own notes (the
// profile, the Wiki, the task and its saved comments), and a chat lives only in the page that shows it. What a person keeps is
// what they press "Save to task" or "Add to Wiki" on.

export const JOB_IDS = ["write", "plan", "answers", "review", "general"] as const;
export type JobId = (typeof JOB_IDS)[number];
export const isJob = (v: unknown): v is JobId => typeof v === "string" && (JOB_IDS as readonly string[]).includes(v);

export type Job = {
  id: JobId;
  label: string;
  hint: string;
  /** The button that starts it. */
  start: string;
  /** The person must paste something first (a text to check). Every other job starts with one press. */
  needsText: boolean;
  /** The Wiki page type a result of this kind is usually kept as. */
  wikiType: "faq" | "other";
  /** What this job asks of the AI. Added to the system prompt. */
  rules: string;
};

export const JOBS: Record<JobId, Job> = {
  write: {
    id: "write",
    label: "Write the text",
    hint: "Posts, captions, bios, ads, listing text, message templates",
    start: "Write it",
    needsText: false,
    wikiType: "other",
    rules:
      "Write the text this task needs, ready to paste. If the task names a channel (Instagram, WhatsApp, email, a listing page), follow how people write there. Give one version, or up to three clearly labelled options when the task is a caption, a headline or an ad. Keep to the brand's voice.",
  },
  plan: {
    id: "plan",
    label: "Make a plan or schedule",
    hint: "Calendars, schedules, targets, steps with dates",
    start: "Make the plan",
    needsText: false,
    wikiType: "other",
    rules:
      "Make the plan or schedule this task needs. Use real dates only where the task or today's date gives them; otherwise use Week 1, Week 2. One line per item: what, who (a role, never a name you made up), by when. End with the one thing most likely to slip.",
  },
  answers: {
    id: "answers",
    label: "Write answers for the Wiki",
    hint: "FAQ, price and payment explanations, objections, brand guide text",
    start: "Write the answers",
    needsText: false,
    wikiType: "faq",
    rules:
      "Write questions with answers, or the page text, that the team can keep in the Wiki. Short answers first (two or three sentences), no marketing talk. Where an answer needs a fact you do not have, write [NEED: the fact] instead of guessing.",
  },
  review: {
    id: "review",
    label: "Check a text I paste",
    hint: "Checks wording, claims and tone against the brand notes",
    start: "Check it",
    needsText: true,
    wikiType: "other",
    rules:
      "Check the text in <from_the_person> against the brand profile, the Wiki and the avoid list. List what is wrong or risky (a claim nothing supports, a promise, a wrong fact, wrong tone, wrong language): quote the few words, say why, give the fix. Then give the whole text corrected. If the text is fine, say so in one line.",
  },
  general: {
    id: "general",
    label: "Help me do this task",
    hint: "Accounts, setup, anything that needs a person: AI prepares what it can",
    start: "Help me",
    needsText: false,
    wikiType: "other",
    rules:
      "Help finish the task. In the first line say what you can prepare and what only a person can do. Then prepare everything that can be prepared: texts to paste, the exact steps to click in order, a short list of what to confirm. Never pretend an account, payment, post, install or signature has happened.",
  },
};

export const JOB_LIST: readonly Job[] = JOB_IDS.map((id) => JOBS[id]);

// Keyword guesses for the kind of help a task most likely needs. Only a starting point: the person can change it. The task's title is
// read first, then its steps and description, so a short title does not hide the work.
const GUESS: readonly [JobId, RegExp][] = [
  ["review", /\b(review|proofread|check (the )?(text|wording|copy))\b/],
  ["answers", /\b(faq|q&a|questions?|answers?|objections?|wiki|pertanyaan|jawaban|price list|payment (scheme|plan)s?|talking points|script)\b/],
  ["plan", /\b(calendar|schedule|plan|roadmap|kpis?|targets?|budget|timeline|cadence|weekly|monthly|rencana|jadwal|agenda|stand-?up)\b/],
  ["write", /\b(write|draft|caption|bio|copy|posts?|reels?|stories|story|ads?|headlines?|descriptions?|listing|templates?|messages?|email|whatsapp|broadcast|newsletter|text|teks|naskah|content)\b/],
];

export function pickJob(title: string, rest: readonly string[] = []): JobId {
  for (const text of [title, rest.join("\n")]) {
    const t = text.toLowerCase();
    if (!t.trim()) continue;
    for (const [id, re] of GUESS) if (re.test(t)) return id;
  }
  return "general";
}

export const DO_LIMITS = {
  /** What the person types to start (only the check job needs it) or to change the draft. */
  ask: 1_500,
  /** The text to check, in the check job. */
  paste: 6_000,
  /** Turns kept in one chat: a draft, a change request, the next draft, and so on. */
  turns: 12,
  /** Everything the page sends back in one request. */
  total: 40_000,
  /** What the AI may write in one reply, and the most a person can save onto a task. */
  reply: 12_000,
  save: 8_000,
  maxTokens: 2_000,
} as const;

export type Turn = { role: "user" | "assistant"; text: string };

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** Plain text: line breaks kept, control characters and runs of blank lines removed. */
export function plain(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\r\n?/g, "\n").replace(CONTROL, "").replace(/\n{3,}/g, "\n\n").trim() : "";
}

/**
 * The chat so far, as the page sends it. It starts with a draft from the AI and then alternates: the person's change request, the
 * next draft. It always ends on the person's turn, which is the one still to be answered. An empty list is the first press.
 */
export function cleanTurns(raw: unknown): { ok: true; turns: Turn[] } | { ok: false } {
  if (raw === undefined || raw === null) return { ok: true, turns: [] };
  if (!Array.isArray(raw) || raw.length > DO_LIMITS.turns || raw.length % 2 !== 0) return { ok: false };
  const turns: Turn[] = [];
  let total = 0;
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i] as { role?: unknown; text?: unknown } | null;
    const role = i % 2 === 0 ? "assistant" : "user";
    if (!t || typeof t !== "object" || t.role !== role || typeof t.text !== "string") return { ok: false };
    const text = plain(t.text);
    const max = role === "assistant" ? DO_LIMITS.reply : DO_LIMITS.ask;
    if (!text || text.length > max) return { ok: false };
    total += text.length;
    turns.push({ role, text });
  }
  return total > DO_LIMITS.total ? { ok: false } : { ok: true, turns };
}

export type Flags = { placeholders: number; wording: string[] };

// Wording a reader could take as a promise. The AI is told not to write it; this is the second look, because the first can fail.
const RISKY: readonly RegExp[] = [
  /\b(?:guarantee[ds]?|guaranteed returns?|risk[- ]free|no risk|zero risk|sure profit)\b/gi,
  /\b(?:garansi|dijamin|pasti untung|untung pasti|bebas risiko|tanpa risiko)\b/gi,
  /\b(?:roi|returns?|yield|capital gains?|profit|imbal hasil|keuntungan|cuan)\b[^.\n]{0,40}?\d[\d.,]*\s?(?:%|persen)/gi,
  /\b\d[\d.,]*\s?(?:%|persen)[^.\n]{0,25}?\b(?:roi|returns?|yield|capital gains?|profit|imbal hasil|keuntungan|cuan)\b/gi,
  /\b(?:prices? (?:will|are going to) (?:rise|go up|increase)|harga (?:akan|pasti) naik)\b/gi,
];

/** What a person should look at before using a draft: gaps still to fill, and wording that sounds like a promise. */
export function flagDraft(text: string): Flags {
  const placeholders = (text.match(/\[[^\]\n]{2,80}\](?!\()/g) ?? []).length;
  const wording: string[] = [];
  for (const re of RISKY) {
    for (const m of text.matchAll(re)) {
      const w = m[0].replace(/\s+/g, " ").trim().slice(0, 60);
      if (!wording.some((x) => x.toLowerCase() === w.toLowerCase())) wording.push(w);
      if (wording.length >= 5) return { placeholders, wording };
    }
  }
  return { placeholders, wording };
}
