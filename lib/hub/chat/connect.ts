// Pure rules for Connect: turning what Zernio's inbox returns (conversations, messages, commented posts, comments) into the same
// conversation model the upload uses, and working out which dates each connected account really has data for. No I/O here, so the
// server (which calls Zernio) and the tests share it. Field names follow docs.zernio.com (List conversations, List messages,
// List commented posts, Get post comments).

import { addDays, dayIn, isIsoDate } from "../tasks/dates";
import { LIMITS, type Convo, type Platform } from "./model";

export const CONNECT = { maxPick: 100, defaultPick: 30, maxDays: 366, postLookbackDays: 60 } as const;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f‎‏]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const validIso = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(new Date(v).getTime());

const LABELS: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp", telegram: "Telegram", twitter: "X", x: "X", bluesky: "Bluesky", reddit: "Reddit",
  linkedin: "LinkedIn", youtube: "YouTube", tiktok: "TikTok", threads: "Threads", imessage: "iMessage", sms: "SMS", line: "LINE", wechat: "WeChat",
};
export function platformLabel(p: string): string {
  const k = p.toLowerCase();
  return LABELS[k] ?? (k ? k[0].toUpperCase() + k.slice(1) : "Other");
}
export const platformOf = (p: string): Platform => (p.toLowerCase() === "whatsapp" ? "whatsapp" : p.toLowerCase() === "telegram" ? "telegram" : "social");

/** Something that can be audited: a direct-message conversation, or the comments under one post. */
export type Source = { kind: "dm" | "comments"; id: string; accountId: string; account: string; platform: string; title: string; at: string };

/** One item of `GET /v1/inbox/conversations`. `at` is the last activity (`updatedTime`). */
export function parseConversation(raw: unknown): Source | null {
  if (!isObj(raw) || typeof raw.id !== "string" || typeof raw.accountId !== "string" || typeof raw.platform !== "string" || !validIso(raw.updatedTime)) return null;
  if (raw.status === "archived") return null;
  const id = raw.id.slice(0, 300);
  const title = text(raw.participantName, 100) || text(raw.whatsappUsername, 100) || `Contact ${text(raw.participantId, 40).slice(-4) || "?"}`;
  return { kind: "dm", id, accountId: raw.accountId.slice(0, 200), account: text(raw.accountUsername, 80), platform: raw.platform.slice(0, 30), title, at: new Date(raw.updatedTime).toISOString() };
}

/** One item of `GET /v1/inbox/comments`: a post. Only posts that have comments are worth reading. */
export function parsePost(raw: unknown): Source | null {
  if (!isObj(raw) || typeof raw.id !== "string" || typeof raw.accountId !== "string" || typeof raw.platform !== "string" || !validIso(raw.createdTime)) return null;
  if (raw.isAd === true || !(Number(raw.commentCount) > 0)) return null;
  const caption = text(raw.content, 60);
  return { kind: "comments", id: raw.id.slice(0, 300), accountId: raw.accountId.slice(0, 200), account: text(raw.accountUsername, 80), platform: raw.platform.slice(0, 30), title: caption ? `Comments on: ${caption}` : "Comments on a post", at: new Date(raw.createdTime).toISOString() };
}

// ---------------------------------------------------------------------------------------------- dates
const fmtCache = new Map<string, Intl.DateTimeFormat>();
/** The wall clock in `tz` read as if it were UTC, in minutes: the same "naive" time the uploads use, so "today" and gaps agree. */
export function naiveMinutes(iso: string, tz: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    fmtCache.set(tz, f);
  }
  const parts = f.formatToParts(d);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) / 60_000;
}
/** The first minute of a calendar day, in the same naive minutes. */
export const dayStart = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 60_000;
};

/** Checks the dates the person chose. `today` is the hub's calendar day. */
export function checkRange(from: unknown, to: unknown, today: string): { ok: true; from: string; to: string } | { ok: false; error: string } {
  if (!isIsoDate(from) || !isIsoDate(to)) return { ok: false, error: "Choose a start and an end date." };
  if (from > to) return { ok: false, error: "The start date is after the end date." };
  if (to > today) return { ok: false, error: "The end date is in the future." };
  if (from < addDays(to, -CONNECT.maxDays)) return { ok: false, error: `Choose at most ${CONNECT.maxDays} days at a time.` };
  return { ok: true, from, to };
}

// ---------------------------------------------------------------------------------------------- what is available
export type Failed = { accountId: string; account: string; platform: string; error: string; code: string };
export type AccountRow = {
  key: string;
  kind: "dm" | "comments";
  account: string;
  platform: string;
  /** Everything Zernio listed for this account. */
  total: number;
  /** Could hold messages in the dates: last activity on or after the start. */
  candidates: number;
  /** Surely holds messages in the dates: last activity inside them. */
  inside: number;
  /** First and last day of activity among everything listed. */
  oldest: string | null;
  newest: string | null;
};

/** Per account: how much Zernio holds, and what falls in the chosen dates. Days are in the hub's timezone. */
export function summarize(sources: readonly Source[], from: string, to: string, tz: string): AccountRow[] {
  const rows = new Map<string, AccountRow>();
  for (const s of sources) {
    const key = `${s.kind}:${s.accountId}`;
    let r = rows.get(key);
    if (!r) rows.set(key, (r = { key, kind: s.kind, account: s.account || "Account", platform: platformLabel(s.platform), total: 0, candidates: 0, inside: 0, oldest: null, newest: null }));
    const day = dayIn(tz, s.at);
    r.total++;
    if (r.oldest === null || day < r.oldest) r.oldest = day;
    if (r.newest === null || day > r.newest) r.newest = day;
    // Comments are read per post, and a post made before the start can still have fresh comments: they count as candidates once the post is recent enough.
    if (s.kind === "dm" ? day >= from : day >= addDays(from, -CONNECT.postLookbackDays)) r.candidates++;
    if (day >= from && day <= to) r.inside++;
  }
  return [...rows.values()].sort((a, b) => b.candidates - a.candidates || a.account.localeCompare(b.account));
}

/** What to read, newest first: conversations with activity inside the dates, then those that were active after them. */
export function pickSources(sources: readonly Source[], from: string, to: string, tz: string): Source[] {
  const day = (s: Source) => dayIn(tz, s.at);
  const keep = sources.filter((s) => (s.kind === "dm" ? day(s) >= from : day(s) >= addDays(from, -CONNECT.postLookbackDays)));
  const rank = (s: Source) => (day(s) >= from && day(s) <= to ? 0 : 1);
  return [...keep].sort((a, b) => rank(a) - rank(b) || (a.at < b.at ? 1 : -1));
}

/** Zernio's failure for one account, in words a person can act on. */
export function explainFailure(f: Pick<Failed, "error" | "code">): string {
  const s = `${f.code} ${f.error}`.toLowerCase();
  if (/reconnect|expired|token|auth|permission|unauthor/.test(s)) return "Needs to be reconnected in Zernio.";
  if (/rate|limit|retry/.test(s)) return "Zernio is limiting requests for this account right now. Try again later.";
  return text(f.error, 120) || "Zernio could not read this account.";
}

// ---------------------------------------------------------------------------------------------- direct messages
const AUTO = new Set(["broadcast", "sequence", "workflow", "comment_automation", "bulk-api", "api"]);
export type DmMessage = { at: string; out: boolean; auto: boolean; text: string };

/** One item of `GET /v1/inbox/conversations/{id}/messages`. null for a deleted message or one with nothing to read. */
export function parseDmMessage(raw: unknown): DmMessage | null {
  if (!isObj(raw) || !validIso(raw.createdAt) || raw.isDeleted === true) return null;
  const dir = raw.direction;
  if (dir !== "incoming" && dir !== "outgoing") return null;
  let body = text(raw.message, LIMITS.text);
  if (!body) {
    if (Array.isArray(raw.attachments) && raw.attachments.length) body = "[media]";
    else return null;
  }
  return { at: new Date(raw.createdAt).toISOString(), out: dir === "outgoing", auto: typeof raw.sentVia === "string" && AUTO.has(raw.sentVia), text: body };
}

export type Built = { convo: Convo; ours: string[]; inRange: number };
const inDates = (t: number | null, fromMin: number, toMin: number): t is number => t !== null && t >= fromMin && t < toMin;

/**
 * A DM conversation cut to the chosen dates. Everyone on our side is named "<account> (team)"; messages Zernio sent on its own
 * (broadcasts, sequences, workflows, the API) are "<account> (automated)" and also count as ours, so the AI can tell a person
 * from a robot. null when fewer than two messages fall inside the dates.
 */
export function buildDm(src: Source, msgs: readonly DmMessage[], from: string, to: string, tz: string): Built | null {
  const fromMin = dayStart(from);
  const toMin = dayStart(addDays(to, 1));
  const team = `${src.account || "Our account"} (team)`;
  const auto = `${src.account || "Our account"} (automated)`;
  let contact = src.title;
  if (contact === team || contact === auto) contact = `${contact} (customer)`;
  const people = [team, contact];
  const used: Convo["msgs"] = [];
  for (const m of msgs) {
    const t = naiveMinutes(m.at, tz);
    if (!inDates(t, fromMin, toMin)) continue;
    let p = m.out ? 0 : 1;
    if (m.out && m.auto) {
      if (people.length === 2) people.push(auto);
      p = people.indexOf(auto);
    }
    used.push({ t: Math.round(t), p, x: m.text });
  }
  if (used.length < 2) return null;
  used.sort((a, b) => a.t - b.t);
  const ours = [team, ...(people.length > 2 ? [auto] : [])];
  return { convo: { name: src.title, platform: platformOf(src.platform), channel: platformOf(src.platform) === "social" ? `${platformLabel(src.platform)} DMs` : "", people, msgs: used.slice(-LIMITS.messages) }, ours, inRange: used.length };
}

// ---------------------------------------------------------------------------------------------- comments
export type CommentRow = { id: string; at: string; author: string; own: boolean; text: string };

/** The comments of `GET /v1/inbox/comments/{postId}`, replies included, each once. */
export function flattenComments(raw: unknown, depth = 0, seen = new Set<string>()): CommentRow[] {
  const out: CommentRow[] = [];
  for (const c of Array.isArray(raw) ? raw : []) {
    if (!isObj(c) || typeof c.id !== "string" || seen.has(c.id) || !validIso(c.createdTime)) continue;
    seen.add(c.id);
    const body = text(c.message, LIMITS.text);
    const from = isObj(c.from) ? c.from : {};
    if (body && c.isHidden !== true) out.push({ id: c.id, at: new Date(c.createdTime).toISOString(), author: text(from.name, 60) || text(from.username, 60) || "Someone", own: from.isOwner === true, text: body });
    if (depth < 3) out.push(...flattenComments(c.replies, depth + 1, seen));
  }
  return out;
}

/** The comments under one post, cut to the chosen dates. null when fewer than two fall inside them. */
export function buildComments(src: Source, rows: readonly CommentRow[], from: string, to: string, tz: string): Built | null {
  const fromMin = dayStart(from);
  const toMin = dayStart(addDays(to, 1));
  const team = `${src.account || "Our account"} (team)`;
  const people = [team];
  const used: Convo["msgs"] = [];
  for (const r of rows) {
    const t = naiveMinutes(r.at, tz);
    if (!inDates(t, fromMin, toMin)) continue;
    let p = 0;
    if (!r.own) {
      const name = r.author === team ? `${r.author} (customer)` : r.author;
      p = people.indexOf(name);
      if (p < 0) {
        if (people.length >= LIMITS.people) continue;
        p = people.push(name) - 1;
      }
    }
    used.push({ t: Math.round(t), p, x: r.text });
  }
  if (used.length < 2) return null;
  used.sort((a, b) => a.t - b.t);
  return { convo: { name: src.title, platform: "social", channel: `${platformLabel(src.platform)} comments`, people, msgs: used.slice(-LIMITS.messages) }, ours: [team], inRange: used.length };
}
