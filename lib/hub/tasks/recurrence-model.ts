// Repeating tasks, the pure part: which days a recipe lands on, how it is written in words, and what a form may contain.
// No I/O. The generator (recurrence-run.ts) and the pages both use these functions, so they can never disagree about a date.
//
// A recipe starts on `starts_on` and counts from there:
//   daily    every N days from the start day
//   weekly   on the chosen weekdays, every N weeks (weeks run Monday to Sunday and the first week is the one the start day is in)
//   monthly  on one day of the month, every N months from the start month; a shorter month uses its last day
// Nothing is made for a day before `starts_on` or after `ends_on`.

import { addDays, diffDays, fmtDay, isIsoDate, startOfWeek, weekdayMon0 } from "./dates";
import { isPriority, type Priority } from "./model";
import { LIMITS, parseTags } from "./rules";

export const FREQS = ["daily", "weekly", "monthly"] as const;
export type Freq = (typeof FREQS)[number];
export const isFreq = (v: unknown): v is Freq => typeof v === "string" && (FREQS as readonly string[]).includes(v);

export const REPEAT_LIMITS = { every: 12, dueIn: 60, items: 30, item: 300, perBrand: 50, tags: 9 } as const;

/** 1 = Monday … 7 = Sunday, the way the database stores it. */
export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WORKDAYS = [1, 2, 3, 4, 5] as const;

export type Schedule = { freq: Freq; every: number; weekdays: number[]; month_day: number | null; starts_on: string; ends_on: string | null };

export type Recurrence = Schedule & {
  id: string;
  brand_id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  priority: Priority;
  tags: string[];
  items: string[];
  due_in_days: number;
  active: boolean;
  last_made_on: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const REPEAT_COLUMNS =
  "id, brand_id, title, description, assignee_id, priority, tags, items, freq, every, weekdays, month_day, due_in_days, starts_on, ends_on, active, last_made_on, created_by, created_at, updated_at";

const daysInMonth = (y: number, m1: number) => new Date(Date.UTC(y, m1, 0)).getUTCDate();
const ymd = (iso: string) => ({ y: +iso.slice(0, 4), m: +iso.slice(5, 7), d: +iso.slice(8, 10) });

/** The longest gap between two days of a valid recipe is a bit over a year (every 12 months), so a scan never needs to go further. */
const SCAN = 400;

/** Does this recipe land on `day`? */
export function occursOn(s: Schedule, day: string): boolean {
  if (day < s.starts_on || (s.ends_on && day > s.ends_on)) return false;
  const every = Math.max(1, s.every);
  if (s.freq === "daily") return diffDays(day, s.starts_on) % every === 0;
  if (s.freq === "weekly") {
    if (!s.weekdays.includes(weekdayMon0(day) + 1)) return false;
    const weeks = Math.round(diffDays(startOfWeek(day), startOfWeek(s.starts_on)) / 7);
    return weeks % every === 0;
  }
  const a = ymd(s.starts_on);
  const b = ymd(day);
  const months = (b.y - a.y) * 12 + (b.m - a.m);
  if (months < 0 || months % every !== 0) return false;
  return b.d === Math.min(s.month_day ?? 1, daysInMonth(b.y, b.m));
}

/** The most recent day it lands on, today included. Null while nothing is due yet (or ever, once it has ended). */
export function latestOn(s: Schedule, today: string): string | null {
  const end = s.ends_on && s.ends_on < today ? s.ends_on : today;
  if (end < s.starts_on) return null;
  const floor = addDays(end, -SCAN) > s.starts_on ? addDays(end, -SCAN) : s.starts_on;
  for (let d = end; d >= floor; d = addDays(d, -1)) if (occursOn(s, d)) return d;
  return null;
}

/** The next day it lands on after `from` (not including `from`). Null if it has ended. */
export function nextAfter(s: Schedule, from: string): string | null {
  let d = addDays(from, 1);
  if (d < s.starts_on) d = s.starts_on;
  for (let i = 0; i <= SCAN; i++, d = addDays(d, 1)) {
    if (s.ends_on && d > s.ends_on) return null;
    if (occursOn(s, d)) return d;
  }
  return null;
}

const ordinal = (n: number) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10]}`;
};

/** The schedule in words: "Every day", "Every weekday", "Every Mon and Thu", "Every 2 weeks on Fri", "Every month on the 5th". */
export function describe(s: Pick<Schedule, "freq" | "every" | "weekdays" | "month_day">): string {
  const n = s.every;
  if (s.freq === "daily") return n === 1 ? "Every day" : `Every ${n} days`;
  if (s.freq === "weekly") {
    const days = [...new Set(s.weekdays)].sort((a, b) => a - b);
    const isWorkdays = days.length === 5 && days.every((d, i) => d === i + 1);
    if (n === 1 && isWorkdays) return "Every weekday";
    if (n === 1 && days.length === 7) return "Every day";
    const names = days.map((d) => WEEKDAY_SHORT[d - 1]);
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
    return n === 1 ? `Every ${list}` : `Every ${n} weeks on ${list}`;
  }
  const day = s.month_day ?? 1;
  const where = day >= 29 ? (day === 31 ? "the last day" : `the ${ordinal(day)} (or the last day)`) : `the ${ordinal(day)}`;
  return n === 1 ? `Every month on ${where}` : `Every ${n} months on ${where}`;
}

/** "Mon 23 Nov" for the next time it lands, or a reason there is none. */
export function nextLabel(r: Pick<Recurrence, keyof Schedule | "active">, today: string): string {
  if (!r.active) return "Paused";
  const next = nextAfter(r, addDays(today, -1));
  if (next) return next === today ? `Today, ${fmtDay(next)}` : fmtDay(next);
  return r.ends_on && r.ends_on < today ? "Ended" : "No more days";
}

/** Tags a made task gets: the recipe's own, then "repeating" so the list can be filtered. Never more than the task limit. */
export function madeTags(tags: readonly string[]): string[] {
  const out = tags.slice(0, REPEAT_LIMITS.tags);
  if (!out.some((t) => t.toLowerCase() === "repeating")) out.push("repeating");
  return out.slice(0, LIMITS.tags);
}

// ---------------------------------------------------------------------------------------------- input
export type RepeatInput = {
  title: string;
  description: string | null;
  assignee_id: string | null;
  priority: Priority;
  tags: string[];
  items: string[];
  freq: Freq;
  every: number;
  weekdays: number[];
  month_day: number | null;
  due_in_days: number;
  starts_on: string;
  ends_on: string | null;
};

const text = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const whole = (v: unknown): number | null => {
  const s = text(v).trim();
  return /^-?\d{1,4}$/.test(s) ? Number(s) : null;
};

/** The checklist box: one item per line; "- [ ] " and numbers are dropped; blank lines are skipped. */
export function parseLines(raw: unknown): { ok: true; items: string[] } | { ok: false; error: string } {
  const items: string[] = [];
  for (const line of text(raw).split(/\r?\n/)) {
    const s = line.trim().replace(/^(?:[-*+•]\s+|\d{1,3}[.)]\s+)/, "").replace(/^\[[ xX]\]\s*/, "").replace(/\s+/g, " ").trim();
    if (!s) continue;
    if (s.length > REPEAT_LIMITS.item) return { ok: false, error: `A checklist item can be up to ${REPEAT_LIMITS.item} characters. Split it into two.` };
    items.push(s);
  }
  if (items.length > REPEAT_LIMITS.items) return { ok: false, error: `A repeating task can carry up to ${REPEAT_LIMITS.items} checklist items.` };
  return { ok: true, items };
}

/** Validates what the form sent. `memberIds` are the people who can be assigned; `today` is the brand's day. */
export function parseRepeat(raw: Record<string, unknown>, memberIds: ReadonlySet<string>, today: string): { ok: true; value: RepeatInput } | { ok: false; error: string } {
  const title = text(raw.title).trim().replace(/\s+/g, " ");
  if (!title) return { ok: false, error: "Give the task a title." };
  if (title.length > LIMITS.title) return { ok: false, error: `Keep the title under ${LIMITS.title} characters.` };
  const description = text(raw.description).trim();
  if (description.length > LIMITS.description) return { ok: false, error: `Keep the description under ${LIMITS.description} characters.` };

  const priority = text(raw.priority).trim() || "normal";
  if (!isPriority(priority)) return { ok: false, error: "Pick a priority from the list." };
  const assignee = text(raw.assigneeId).trim();
  if (assignee && !memberIds.has(assignee)) return { ok: false, error: "That person is not on this brand's team." };

  const lines = parseLines(raw.items);
  if (!lines.ok) return lines;

  const freq = text(raw.freq).trim();
  if (!isFreq(freq)) return { ok: false, error: "Pick how often it repeats." };
  const every = whole(raw.every ?? 1);
  if (every === null || every < 1 || every > REPEAT_LIMITS.every) return { ok: false, error: `Repeat every 1 to ${REPEAT_LIMITS.every}.` };

  let weekdays: number[] = [];
  if (freq === "weekly") {
    const list = Array.isArray(raw.weekdays) ? raw.weekdays : text(raw.weekdays).split(",");
    weekdays = [...new Set(list.map((d) => whole(d)).filter((d): d is number => d !== null && d >= 1 && d <= 7))].sort((a, b) => a - b);
    if (weekdays.length === 0) return { ok: false, error: "Pick at least one day of the week." };
  }
  let month_day: number | null = null;
  if (freq === "monthly") {
    month_day = whole(raw.monthDay);
    if (month_day === null || month_day < 1 || month_day > 31) return { ok: false, error: "Pick a day of the month, 1 to 31." };
  }

  const dueIn = whole(raw.dueInDays ?? 0);
  if (dueIn === null || dueIn < 0 || dueIn > REPEAT_LIMITS.dueIn) return { ok: false, error: `Due after 0 to ${REPEAT_LIMITS.dueIn} days.` };

  const startsRaw = text(raw.startsOn).trim() || today;
  if (!isIsoDate(startsRaw)) return { ok: false, error: "The first day is not a valid date." };
  const endsRaw = text(raw.endsOn).trim();
  if (endsRaw && !isIsoDate(endsRaw)) return { ok: false, error: "The last day is not a valid date." };
  if (endsRaw && endsRaw < startsRaw) return { ok: false, error: "The last day is before the first day." };

  const s: Schedule = { freq, every, weekdays, month_day, starts_on: startsRaw, ends_on: endsRaw || null };
  // A recipe that can never land would sit in the list doing nothing. Say so now.
  if (!nextAfter(s, addDays(startsRaw, -1))) return { ok: false, error: "It would never repeat between those dates. Move the last day later." };

  return {
    ok: true,
    value: {
      title,
      description: description || null,
      assignee_id: assignee || null,
      priority,
      tags: parseTags(text(raw.tags)).slice(0, REPEAT_LIMITS.tags),
      items: lines.items,
      freq,
      every,
      weekdays,
      month_day,
      due_in_days: dueIn,
      starts_on: startsRaw,
      ends_on: endsRaw || null,
    },
  };
}
