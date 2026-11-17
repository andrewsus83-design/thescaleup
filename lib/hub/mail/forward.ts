// Pure rules for forwarding a message: the subject, the quoted text, and which of the original's files come along. No I/O.

import { ATTACH_LIMITS } from "./files";
import { MAIL_LIMITS } from "./model";

const ONE_LINE = (s: string) => s.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Fwd: Subject", once: a subject that already starts with Fwd: or Fw: is kept as it is. */
export function forwardSubject(subject: string): string {
  const s = ONE_LINE(subject);
  const out = /^(fw|fwd)\s*:/i.test(s) ? s : `Fwd: ${s || "(no subject)"}`;
  return out.slice(0, MAIL_LIMITS.subject);
}

export type Quoted = { from_name: string | null; from_email: string; to_emails: string[]; cc_emails: string[]; subject: string; text_body: string };

/**
 * What the writing area starts with: two empty lines for the person's own note, then the original under a "Forwarded message" header,
 * like Gmail. Plain text only, and shortened when the original is longer than a message may be.
 */
export function forwardBody(m: Quoted, dateLabel: string): string {
  const who = ONE_LINE(m.from_name ?? "");
  const head = ["---------- Forwarded message ---------", `From: ${who ? `${who} <${m.from_email}>` : m.from_email}`, `Date: ${dateLabel}`, `Subject: ${ONE_LINE(m.subject) || "(no subject)"}`, `To: ${m.to_emails.join(", ")}`];
  if (m.cc_emails.length > 0) head.push(`Cc: ${m.cc_emails.join(", ")}`);
  const text = `\n\n${head.join("\n")}\n\n${(m.text_body ?? "").replace(/\r\n/g, "\n").trim()}`;
  const note = "\n\n[Shortened: the original is longer than a message can be.]";
  return text.length > MAIL_LIMITS.body ? `${text.slice(0, MAIL_LIMITS.body - note.length).trimEnd()}${note}` : text;
}

/** "Tue, 17 Nov 2026, 10:58" in the hub's time zone. */
export function forwardDate(iso: string, tz: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(t));
  } catch {
    return new Date(t).toISOString();
  }
}

export type FileRef = { messageId: string; attachmentId: string };

/** The ticked files of the original, as the form sends them: "<message id>:<file id>". Each is checked, repeats are dropped. */
export function parseFileRefs(values: readonly unknown[]): { ok: true; list: FileRef[] } | { ok: false; error: string } {
  const list: FileRef[] = [];
  for (const v of values) {
    if (typeof v !== "string" || v === "") continue;
    const m = /^([^:]+):([\w-]{1,100})$/.exec(v);
    if (!m || !ID.test(m[1])) return { ok: false, error: "A file of the original message is no longer available. Untick it, or reload the page." };
    if (!list.some((r) => r.messageId === m[1] && r.attachmentId === m[2])) list.push({ messageId: m[1], attachmentId: m[2] });
  }
  if (list.length > ATTACH_LIMITS.files) return { ok: false, error: `Up to ${ATTACH_LIMITS.files} files per message.` };
  return { ok: true, list };
}
