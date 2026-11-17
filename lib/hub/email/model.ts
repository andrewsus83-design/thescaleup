// Pure rules for the email builder: what a campaign is made of (blocks), how it becomes an email that opens the same in Gmail, Outlook and
// phones (tables, inline styles, no scripts), the merge tags, safe links, the unsubscribe token and the starting designs. No I/O.
// The browser uses the same code for the live preview that the server uses to send, so what you see is what is sent.

import { isEmail } from "../mail/model";

export const EMAIL_LIMITS = { blocks: 60, text: 5000, heading: 200, label: 60, alt: 200, url: 2000, subject: 200, preheader: 150, footer: 400, name: 120, recipients: 1000, batch: 50 } as const;

export const BLOCK_TYPES = ["heading", "text", "image", "button", "divider", "spacer"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];
export const BLOCK_LABEL: Record<BlockType, string> = { heading: "Heading", text: "Text", image: "Image", button: "Button", divider: "Divider", spacer: "Space" };

export type Block =
  | { type: "heading"; text: string }
  | { type: "text"; text: string }
  | { type: "image"; url: string; alt: string; link: string }
  | { type: "button"; label: string; url: string }
  | { type: "divider" }
  | { type: "spacer" };
export type Doc = { subject: string; preheader: string; accent: string; footer: string; blocks: Block[] };

export const DEFAULT_ACCENT = "#0f766e";
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const clean = (v: unknown, max: number, keepBreaks = false) => {
  if (typeof v !== "string") return "";
  const s = keepBreaks ? v.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, "") : v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ");
  return s.trim().slice(0, max);
};

export const emptyDoc = (): Doc => ({ subject: "", preheader: "", accent: DEFAULT_ACCENT, footer: "", blocks: [] });

export function newBlock(type: BlockType): Block {
  switch (type) {
    case "heading": return { type, text: "" };
    case "text": return { type, text: "" };
    case "image": return { type, url: "", alt: "", link: "" };
    case "button": return { type, label: "", url: "" };
    default: return { type };
  }
}

/** Normalises whatever came from the browser or the database into a Doc: trimmed, clamped, unknown blocks dropped. Never throws. */
export function parseDoc(raw: unknown): Doc {
  const o = isObj(raw) ? raw : {};
  const accent = typeof o.accent === "string" && /^#[0-9a-f]{6}$/i.test(o.accent.trim()) ? o.accent.trim().toLowerCase() : DEFAULT_ACCENT;
  const blocks: Block[] = [];
  for (const b of Array.isArray(o.blocks) ? o.blocks : []) {
    if (!isObj(b) || blocks.length >= EMAIL_LIMITS.blocks) continue;
    switch (b.type) {
      case "heading": blocks.push({ type: "heading", text: clean(b.text, EMAIL_LIMITS.heading) }); break;
      case "text": blocks.push({ type: "text", text: clean(b.text, EMAIL_LIMITS.text, true) }); break;
      case "image": blocks.push({ type: "image", url: clean(b.url, EMAIL_LIMITS.url), alt: clean(b.alt, EMAIL_LIMITS.alt), link: clean(b.link, EMAIL_LIMITS.url) }); break;
      case "button": blocks.push({ type: "button", label: clean(b.label, EMAIL_LIMITS.label), url: clean(b.url, EMAIL_LIMITS.url) }); break;
      case "divider": blocks.push({ type: "divider" }); break;
      case "spacer": blocks.push({ type: "spacer" }); break;
    }
  }
  return { subject: clean(o.subject, EMAIL_LIMITS.subject), preheader: clean(o.preheader, EMAIL_LIMITS.preheader), accent, footer: clean(o.footer, EMAIL_LIMITS.footer, true), blocks };
}

/** A link that is safe to put in an email: https (or mailto for a button), no login in it. null when it is not. */
export function safeUrl(v: string, allowMailto = false): string | null {
  const s = v.trim();
  if (!s || s.length > EMAIL_LIMITS.url) return null;
  try {
    const u = new URL(s);
    if (u.username || u.password) return null;
    if (u.protocol === "https:" && u.hostname.includes(".")) return u.toString();
    if (allowMailto && u.protocol === "mailto:" && isEmail(decodeURIComponent(u.pathname))) return u.toString();
  } catch {
    /* not a link */
  }
  return null;
}

/** What is wrong with a design, in words, before it is sent. Saving a draft does not need these fixed; sending does. */
export function docProblems(doc: Doc): string[] {
  const out: string[] = [];
  if (!doc.subject) out.push("Add a subject.");
  if (doc.blocks.length === 0) out.push("Add at least one block.");
  if (!doc.footer) out.push("Add your name and address to the footer. Email to many people should say who sent it.");
  doc.blocks.forEach((b, i) => {
    const at = `Block ${i + 1} (${BLOCK_LABEL[b.type].toLowerCase()})`;
    if (b.type === "heading" && !b.text) out.push(`${at} is empty.`);
    if (b.type === "text" && !b.text) out.push(`${at} is empty.`);
    if (b.type === "button") {
      if (!b.label) out.push(`${at} needs a label.`);
      if (!safeUrl(b.url, true)) out.push(`${at} needs a link that starts with https://.`);
    }
    if (b.type === "image") {
      if (!safeUrl(b.url)) out.push(`${at} needs an image link that starts with https://.`);
      if (!b.alt) out.push(`${at} needs a short description for people who cannot see it.`);
      if (b.link && !safeUrl(b.link, true)) out.push(`${at}: the link on the image must start with https://.`);
    }
  });
  return out;
}

// ---------------------------------------------------------------------------------------------- merge tags
export type Vars = { first_name?: string; name?: string; company?: string; brand?: string };
export const MERGE_TAGS = ["first_name", "name", "company", "brand"] as const;
const TAG = /\{\{\s*([a-z_]+)\s*(?:\|([^{}]{0,30}))?\}\}/gi;

/** {{first_name}} or {{first_name|there}}: the value, else the fallback after the bar, else nothing. Unknown tags become nothing. */
export function merge(s: string, vars: Vars): string {
  return s.replace(TAG, (_m, tag: string, fallback?: string) => {
    const v = (vars as Record<string, string | undefined>)[tag.toLowerCase()];
    return v && v.trim() ? v.trim() : (fallback ?? "").trim();
  });
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

// ---------------------------------------------------------------------------------------------- rendering
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const lines = (s: string) => esc(s).replace(/\n/g, "<br>");
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Black or white text, whichever reads on the accent colour. */
export function onAccent(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#111827" : "#ffffff";
}

export type Rendered = { html: string; text: string };

/**
 * One email. `vars` fill the merge tags, `unsubscribe` is the link in the footer (always present when sending). Text is escaped after
 * the tags are filled in, so a name with markup in it stays text. Links that are not safe are left out, never rewritten.
 */
export function renderEmail(doc: Doc, vars: Vars, unsubscribe: string | null): Rendered {
  const m = (s: string) => merge(s, vars);
  const accent = doc.accent;
  const rows: string[] = [];
  const plain: string[] = [];
  for (const b of doc.blocks) {
    if (b.type === "heading") {
      const t = m(b.text);
      if (!t) continue;
      rows.push(`<tr><td style="padding:24px 32px 4px;font-family:${FONT};font-size:24px;line-height:32px;font-weight:700;color:#111827">${esc(t)}</td></tr>`);
      plain.push(t.toUpperCase());
    } else if (b.type === "text") {
      const paras = m(b.text).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
      if (!paras.length) continue;
      rows.push(`<tr><td style="padding:8px 32px;font-family:${FONT};font-size:16px;line-height:26px;color:#374151">${paras.map((p) => `<p style="margin:0 0 14px">${lines(p)}</p>`).join("")}</td></tr>`);
      plain.push(paras.join("\n\n"));
    } else if (b.type === "image") {
      const src = safeUrl(b.url);
      if (!src) continue;
      const img = `<img src="${esc(src)}" alt="${esc(m(b.alt))}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:8px">`;
      const link = b.link ? safeUrl(b.link, true) : null;
      rows.push(`<tr><td style="padding:12px 32px">${link ? `<a href="${esc(link)}" style="text-decoration:none">${img}</a>` : img}</td></tr>`);
      plain.push(`[${m(b.alt)}]${link ? ` ${link}` : ""}`);
    } else if (b.type === "button") {
      const href = safeUrl(b.url, true);
      const label = m(b.label);
      if (!label) continue;
      if (!href) {
        rows.push(`<tr><td style="padding:8px 32px;font-family:${FONT};font-size:16px;color:#374151">${esc(label)}</td></tr>`);
        plain.push(label);
        continue;
      }
      rows.push(
        `<tr><td style="padding:12px 32px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:999px;background:${accent}"><a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:700;line-height:20px;color:${onAccent(accent)};text-decoration:none;border-radius:999px">${esc(label)}</a></td></tr></table></td></tr>`,
      );
      plain.push(`${label}: ${href}`);
    } else if (b.type === "divider") {
      rows.push(`<tr><td style="padding:12px 32px"><div style="height:1px;line-height:1px;background:#e5e7eb;font-size:1px">&nbsp;</div></td></tr>`);
      plain.push("----------");
    } else {
      rows.push(`<tr><td style="height:24px;line-height:24px;font-size:1px">&nbsp;</td></tr>`);
    }
  }
  const footer = m(doc.footer);
  const unsub = unsubscribe ? safeUrl(unsubscribe) : null;
  const pre = m(doc.preheader);
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(m(doc.subject))}</title></head>` +
    `<body style="margin:0;padding:0;background:#f3f4f6">` +
    (pre ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">${esc(pre)}${"&#8204;&nbsp;".repeat(30)}</div>` : "") +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6"><tr><td align="center" style="padding:24px 12px">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;border-top:6px solid ${accent}">` +
    rows.join("") +
    `<tr><td style="padding:24px 32px 32px;font-family:${FONT};font-size:12px;line-height:18px;color:#6b7280;border-top:1px solid #f3f4f6">` +
    (footer ? `<p style="margin:0 0 8px">${lines(footer)}</p>` : "") +
    (unsub ? `<p style="margin:0">You get this because you are in our contacts. <a href="${esc(unsub)}" style="color:#6b7280;text-decoration:underline">Unsubscribe</a></p>` : "") +
    `</td></tr></table></td></tr></table></body></html>`;
  const text = [...plain, "", footer, unsub ? `Unsubscribe: ${unsub}` : ""].filter((s, i, a) => s !== "" || (i > 0 && a[i - 1] !== "")).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  return { html, text };
}

// ---------------------------------------------------------------------------------------------- audience
export const AUDIENCE_KINDS = ["lead", "client"] as const;
export type AudienceKind = (typeof AUDIENCE_KINDS)[number];
export type Audience = { kinds: AudienceKind[]; stages: string[] };

export function parseAudience(raw: unknown): Audience {
  const o = isObj(raw) ? raw : {};
  const kinds = (Array.isArray(o.kinds) ? o.kinds : []).filter((k): k is AudienceKind => k === "lead" || k === "client");
  const stages = (Array.isArray(o.stages) ? o.stages : []).filter((s): s is string => typeof s === "string" && /^[a-z0-9_-]{1,40}$/i.test(s));
  return { kinds: [...new Set(kinds)], stages: [...new Set(stages)].slice(0, 40) };
}

export type Person = { id: string; email: string; name: string; company: string };
export type Recipient = { person_id: string; email: string; vars: { name: string; company: string } };
export type Skips = { noEmail: number; invalid: number; duplicate: number; suppressed: number; overLimit: number };

/** Who gets it: one email per address, nobody who unsubscribed or bounced, nobody without a real address, at most `max`. */
export function buildRecipients(people: readonly Person[], suppressed: ReadonlySet<string>, max: number = EMAIL_LIMITS.recipients): { list: Recipient[]; skips: Skips } {
  const skips: Skips = { noEmail: 0, invalid: 0, duplicate: 0, suppressed: 0, overLimit: 0 };
  const seen = new Set<string>();
  const list: Recipient[] = [];
  for (const p of people) {
    const email = p.email.trim().toLowerCase();
    if (!email) skips.noEmail++;
    else if (!isEmail(email)) skips.invalid++;
    else if (seen.has(email)) skips.duplicate++;
    else if (suppressed.has(email)) skips.suppressed++;
    else if (list.length >= max) skips.overLimit++;
    else {
      seen.add(email);
      list.push({ person_id: p.id, email, vars: { name: p.name.slice(0, 120), company: p.company.slice(0, 120) } });
    }
  }
  return { list, skips };
}

// ---------------------------------------------------------------------------------------------- starting designs
export type Starter = { id: string; name: string; hint: string; doc: Doc };
const d = (subject: string, preheader: string, blocks: Block[]): Doc => ({ subject, preheader, accent: DEFAULT_ACCENT, footer: "{{brand}}\nYour address here", blocks });

/** Designs to start from. Everything in them is a sentence to replace, not a promise. */
export const STARTERS: Starter[] = [
  { id: "blank", name: "Blank", hint: "Start with nothing", doc: d("", "", []) },
  {
    id: "announcement",
    name: "Announcement",
    hint: "One message and one button",
    doc: d("A short, clear subject", "The first line people see next to the subject", [
      { type: "heading", text: "Hi {{first_name|there}}," },
      { type: "text", text: "Tell people what is new in two or three sentences. Say what it means for them and what to do next." },
      { type: "button", label: "See the details", url: "" },
    ]),
  },
  {
    id: "newsletter",
    name: "Newsletter",
    hint: "Two stories with images",
    doc: d("{{brand}} news", "Two things worth your time", [
      { type: "heading", text: "This month at {{brand}}" },
      { type: "text", text: "Hi {{first_name|there}}, here is what happened and what is coming." },
      { type: "image", url: "", alt: "", link: "" },
      { type: "heading", text: "First story" },
      { type: "text", text: "Two or three sentences." },
      { type: "button", label: "Read more", url: "" },
      { type: "divider" },
      { type: "heading", text: "Second story" },
      { type: "text", text: "Two or three sentences." },
      { type: "button", label: "Read more", url: "" },
    ]),
  },
  {
    id: "event",
    name: "Event invitation",
    hint: "Date, place and a button to reply",
    doc: d("You are invited: event name", "Date, time and place inside", [
      { type: "heading", text: "You are invited, {{first_name|friend}}" },
      { type: "text", text: "Event name\nDate and time\nPlace" },
      { type: "text", text: "Say in two sentences why they should come and what they will get out of it." },
      { type: "button", label: "Reserve my place", url: "" },
      { type: "text", text: "Cannot make it? Reply to this email and tell us." },
    ]),
  },
  {
    id: "article",
    name: "Article",
    hint: "Share one article",
    doc: d("Article title", "A line that makes them want to read it", [
      { type: "image", url: "", alt: "", link: "" },
      { type: "heading", text: "Article title" },
      { type: "text", text: "The first paragraph of the article, or a short summary of it." },
      { type: "button", label: "Read the full article", url: "" },
    ]),
  },
];
