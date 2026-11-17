// What people say to the bot, in code. No I/O. Everything Telegram sends is untrusted text: it is cut to size, control characters are
// dropped, and nothing in it is ever put in an address or read as markup (replies are plain text).

import { addDays, isIsoDate, weekdayMon0, fmtDay } from "../tasks/dates";

const o = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, " ").replace(/[ \t]+/g, " ").trim().slice(0, max) : "");
const safeInt = (v: unknown): number | null => (typeof v === "number" && Number.isSafeInteger(v) ? v : null);

export const MAX_TEXT = 1000;

export type ChatRef = { id: number; kind: "private" | "group" | "supergroup" | "channel"; title: string };
export type Incoming =
  | { kind: "message"; updateId: number; chat: ChatRef; fromId: number; fromName: string; text: string }
  | { kind: "callback"; updateId: number; callbackId: string; chat: ChatRef; fromId: number; data: string }
  | { kind: "joined"; updateId: number; chat: ChatRef };

function chatOf(raw: unknown): ChatRef | null {
  const c = o(raw);
  const id = safeInt(c.id);
  const kind = c.type;
  if (id === null || (kind !== "private" && kind !== "group" && kind !== "supergroup" && kind !== "channel")) return null;
  const person = [clean(c.first_name, 60), clean(c.last_name, 60)].filter(Boolean).join(" ");
  return { id, kind, title: (clean(c.title, 120) || person || (typeof c.username === "string" ? `@${clean(c.username, 60)}` : "") || "Unnamed chat").slice(0, 120) };
}

/** One update from Telegram as something the hub understands, or null when it is nothing to act on (an edit, a sticker, a channel post...). */
export function parseIncoming(raw: unknown): Incoming | null {
  const u = o(raw);
  const updateId = safeInt(u.update_id);
  if (updateId === null) return null;

  if (u.callback_query) {
    const q = o(u.callback_query);
    const msg = o(q.message);
    const chat = chatOf(msg.chat);
    const fromId = safeInt(o(q.from).id);
    const data = clean(q.data, 64);
    const callbackId = typeof q.id === "string" ? q.id.slice(0, 100) : "";
    if (!chat || fromId === null || !data || !callbackId) return null;
    return { kind: "callback", updateId, callbackId, chat, fromId, data };
  }

  if (u.message) {
    const m = o(u.message);
    const chat = chatOf(m.chat);
    const from = o(m.from);
    const fromId = safeInt(from.id);
    if (!chat || fromId === null || from.is_bot === true) return null;
    const text = clean(m.text, MAX_TEXT);
    if (!text) return null;
    const fromName = [clean(from.first_name, 60), clean(from.last_name, 60)].filter(Boolean).join(" ") || "there";
    return { kind: "message", updateId, chat, fromId, fromName, text };
  }

  if (u.my_chat_member) {
    const chat = chatOf(o(u.my_chat_member).chat);
    const status = o(o(u.my_chat_member).new_chat_member).status;
    if (chat && (status === "member" || status === "administrator")) return { kind: "joined", updateId, chat };
  }
  return null;
}

/** "/tasks", "/add@MyBot Post the reel" -> { cmd: "add", args: "Post the reel" }. A command meant for a different bot is null. */
export function parseCommand(text: string, botUsername: string | null): { cmd: string; args: string } | null {
  const m = /^\/([A-Za-z_]{1,32})(?:@([A-Za-z0-9_]{3,64}))?(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!m) return null;
  if (m[2] && botUsername && m[2].toLowerCase() !== botUsername.toLowerCase()) return null;
  return { cmd: m[1].toLowerCase(), args: (m[3] ?? "").trim() };
}

// ---------------------------------------------------------------------------------------------- link codes
/** No 0/O/1/I/L: nobody mistypes a code read off a screen. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;
export const CODE_MINUTES = 15;

/** Eight characters from the alphabet, from random bytes (one per character). */
export function codeFrom(bytes: Uint8Array): string {
  let s = "";
  // 256 is not a multiple of 31, so a byte is only used below 248: every letter is equally likely.
  for (const b of bytes) if (b < 248 && s.length < CODE_LENGTH) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return s;
}

/** What a person typed back, tidied: upper case, spaces and dashes dropped. Null if it cannot be a code. */
export function readCode(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[\s-]+/g, "");
  return s.length === CODE_LENGTH && [...s].every((c) => CODE_ALPHABET.includes(c)) ? s : null;
}

// ---------------------------------------------------------------------------------------------- days in words
const WEEKDAYS: Record<string, number> = {
  mon: 0, monday: 0, senin: 0,
  tue: 1, tues: 1, tuesday: 1, selasa: 1,
  wed: 2, wednesday: 2, rabu: 2,
  thu: 3, thur: 3, thurs: 3, thursday: 3, kamis: 3,
  fri: 4, friday: 4, jumat: 4, jum: 4,
  sat: 5, saturday: 5, sabtu: 5,
  sun: 6, sunday: 6, minggu: 6,
};

/** A day in words: today, tomorrow, a weekday (the next one, never today), a date, or "in 3 days". Spoken in English or Bahasa. Null when it is not a day. */
export function dayWord(word: string, today: string): string | null {
  const w = word.trim().toLowerCase().replace(/[.,;:!]+$/, "");
  if (isIsoDate(w)) return w;
  if (w === "today" || w === "hari ini" || w === "hariini") return today;
  if (w === "tomorrow" || w === "tmr" || w === "tmrw" || w === "besok") return addDays(today, 1);
  if (w === "lusa") return addDays(today, 2);
  const inDays = /^(?:in\s+|\+)(\d{1,3})\s*(?:d|day|days|hari)?$/.exec(w);
  if (inDays) return addDays(today, Number(inDays[1]));
  if (w in WEEKDAYS) {
    const ahead = (WEEKDAYS[w] - weekdayMon0(today) + 7) % 7;
    return addDays(today, ahead === 0 ? 7 : ahead);
  }
  return null;
}

/** "tomorrow call Dewi" -> { due, title }. Looks at the first one to three words. */
export function leadingDay(text: string, today: string): { due: string; rest: string } | null {
  const words = text.trim().split(/\s+/);
  for (const n of [3, 2, 1]) {
    if (words.length < n) continue;
    const due = dayWord(words.slice(0, n).join(" "), today);
    if (due) return { due, rest: words.slice(n).join(" ") };
  }
  return null;
}

/** "Post the reel due fri" -> { title: "Post the reel", due }. Also reads "by fri" and "sampai besok". Without a day word it is all title. */
export function trailingDue(text: string, today: string): { title: string; due: string | null } {
  const m = /^([\s\S]*?)\s+(?:due|by|sampai|deadline)\s+(.+)$/i.exec(text.trim());
  if (m) {
    const due = dayWord(m[2], today);
    if (due) return { title: m[1].trim(), due };
  }
  return { title: text.trim(), due: null };
}

// ---------------------------------------------------------------------------------------------- words back
export type ListedTask = { id: string; title: string; due: string | null; priority: string; late: boolean };

const oneLine = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/** My open tasks as numbered lines. The same numbers label the buttons, so a tap and a line always match. */
export function taskList(tasks: readonly ListedTask[], more: number): string {
  if (tasks.length === 0) return "Nothing open is assigned to you.";
  const lines = tasks.map((t, i) => `${i + 1}. ${oneLine(t.title, 90)}${t.priority === "urgent" ? " [urgent]" : t.priority === "high" ? " [high]" : ""}${t.due ? ` (${t.late ? "late, " : "due "}${fmtDay(t.due)})` : ""}`);
  return ["Your open tasks:", ...lines, ...(more > 0 ? [`and ${more} more in the hub`] : []), "", "Tap a number to mark it done."].join("\n");
}

export const HELP = [
  "What I can do:",
  "/today  your tasks due today or late",
  "/tasks  your open tasks, tap one to mark it done",
  "/add Post the Friday reel due fri  add a task for yourself",
  "/remind tomorrow call Dewi  a task for you with a day (besok, lusa, mon..sun, 2026-12-01)",
  "/done weekly report  mark a task done by part of its name",
  "/stop  unlink this Telegram from the hub",
].join("\n");

export const NOT_LINKED = "I do not know who you are yet. In the hub open Settings, Telegram, choose Link my Telegram, then send me the code here in a private chat.";
