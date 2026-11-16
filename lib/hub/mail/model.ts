// Pure helpers for Mail: addresses, subjects, threading ids, snippets and plain-text/HTML conversion. No I/O, so they are tested on their own.

export const MAIL_LIMITS = { recipients: 20, subject: 200, body: 50_000, snippet: 160, storedText: 200_000, storedHtml: 500_000 } as const;

const EMAIL = /^[^\s@<>(),;:"\\]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export const isEmail = (v: string) => v.length <= 254 && EMAIL.test(v);

/** "Ada Lovelace <ada@x.com>" or "ada@x.com" → name and lower-cased address, or null. */
export function parseAddress(raw: string): { email: string; name: string } | null {
  const s = raw.trim();
  const m = /^(.*)<([^<>]+)>\s*$/.exec(s);
  const email = (m ? m[2] : s).trim().toLowerCase();
  if (!isEmail(email)) return null;
  const name = m ? m[1].trim().replace(/^"(.*)"$/, "$1").replace(/[\r\n"<>]/g, " ").replace(/\s+/g, " ").trim() : "";
  return { email, name: name.slice(0, 80) };
}

/** A list typed into a box: separated by commas, semicolons or line breaks. Names in angle brackets are fine. */
export function parseRecipients(raw: string, max: number = MAIL_LIMITS.recipients): { ok: true; list: string[] } | { ok: false; error: string } {
  const parts = raw.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const a = parseAddress(p);
    if (!a) return { ok: false, error: `"${p.slice(0, 60)}" is not an email address.` };
    if (!out.includes(a.email)) out.push(a.email);
  }
  if (out.length > max) return { ok: false, error: `Up to ${max} recipients per message.` };
  return { ok: true, list: out };
}

/** What shows next to an address in a "From" header. Quotes, brackets and line breaks would break the header, so they go. */
export function fromHeader(name: string | null | undefined, email: string): string {
  const clean = (name ?? "").replace(/[\r\n"<>\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return clean ? `"${clean}" <${email}>` : email;
}

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
/** Returns an error message, or null when `name` can be added as a domain (a subdomain like mail.brand.com is fine). */
export function domainError(name: string): string | null {
  if (!name) return "Type the domain.";
  if (name.length > 253) return "That domain is too long.";
  if (/^https?:\/\//.test(name) || name.includes("/") || name.includes("@")) return "Type only the domain, like brand.com.";
  const labels = name.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l))) return "That does not look like a domain. Use letters, numbers and hyphens, like brand.com.";
  if (!/^[a-z]{2,}$/.test(labels[labels.length - 1])) return "The ending of the domain (like .com) must be letters.";
  return null;
}

export function localPartError(v: string): string | null {
  if (!v) return "Type the part before the @.";
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(v)) return "Use lowercase letters, numbers, dots, hyphens and underscores, starting with a letter or number.";
  return null;
}

export const replySubject = (s: string) => (/^\s*re:/i.test(s) ? s.trim() : `Re: ${s.trim()}`.trim()).slice(0, 300);

/** The message ids in an In-Reply-To or References header: each one is written <like-this@host>. */
export function messageIds(...headers: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const h of headers) for (const m of (h ?? "").matchAll(/<[^<>\s]+>/g)) if (!out.includes(m[0])) out.push(m[0]);
  return out;
}

export function snippet(text: string, max: number = MAIL_LIMITS.snippet): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
/** Plain text from an HTML body, for the list preview and for mail that has no text part. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The HTML twin of a typed plain-text message: escaped, with paragraphs and line breaks kept, and links made clickable. */
export function textToHtml(text: string): string {
  const body = esc(text.trim())
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)"'])/g, '<a href="$1">$1</a>')
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a">${body}</div>`;
}

export type ThreadAddress = { name: string; email: string };
/** "Ada, Grace" style label for a list row. */
export const personLabel = (name: string | null | undefined, email: string) => (name?.trim() ? name.trim() : email.split("@")[0]);

/** Outbound status only moves forward: a late "sent" must not undo "bounced". */
const RANK: Record<string, number> = { received: 0, sent: 1, delivered: 2, failed: 3, bounced: 3, complained: 3 };
export const moveStatus = (from: string, to: string): string => ((RANK[to] ?? -1) > (RANK[from] ?? 0) ? to : from);

/** A subject without the Re:/Fwd: prefixes, for matching a reply to its conversation when the message ids do not line up. */
export const normalizeSubject = (s: string) =>
  s
    .replace(/^(\s*(re|fw|fwd|aw|sv)\s*:\s*)+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
