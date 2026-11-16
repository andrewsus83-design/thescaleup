// Calendar-day helpers. A task's due date is a calendar day ("2026-11-20"), not an instant, so everything here works on
// YYYY-MM-DD strings and fixed UTC arithmetic. The only timezone-aware step is turning "now" and a timestamp into a day.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAYS_SHORT = DAYS;

export const DEFAULT_TZ = "Asia/Jakarta";
/** The brand's day boundary. One value for now (HUB_TZ), per-brand later. */
export const hubTz = () => process.env.HUB_TZ?.trim() || DEFAULT_TZ;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = ISO.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

const toDate = (iso: string) => {
  const m = ISO.exec(iso)!;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
};
const toIso = (d: Date) => d.toISOString().slice(0, 10);

/** The calendar day it is in `tz` at `at` (default now). */
export function dayIn(tz: string, at: Date | string = new Date()): string {
  const d = typeof at === "string" ? new Date(at) : at;
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export const todayIn = (tz: string, now: Date = new Date()) => dayIn(tz, now);

export const addDays = (iso: string, n: number) => toIso(new Date(toDate(iso).getTime() + n * 86_400_000));
/** Whole days from b to a (a - b). */
export const diffDays = (a: string, b: string) => Math.round((toDate(a).getTime() - toDate(b).getTime()) / 86_400_000);
/** Monday = 0 … Sunday = 6. */
export const weekdayMon0 = (iso: string) => (toDate(iso).getUTCDay() + 6) % 7;
export const startOfWeek = (iso: string) => addDays(iso, -weekdayMon0(iso));

export const monthKey = (iso: string) => iso.slice(0, 7);
export const isMonthKey = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}
export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

/** "Mon 16 Nov" */
export function fmtDay(iso: string): string {
  const d = toDate(iso);
  return `${DAYS[weekdayMon0(iso)]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}

/** "14:05" in tz. */
export function fmtTime(at: string | Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(typeof at === "string" ? new Date(at) : at);
}

/** "14:05" for today, "Mon 16 Nov 14:05" for another day. */
export function fmtStamp(at: string | Date, tz: string, today: string): string {
  const day = dayIn(tz, at);
  return day === today ? fmtTime(at, tz) : `${fmtDay(day)} ${fmtTime(at, tz)}`;
}

/** "2h 05m" for a number of minutes. */
export function fmtDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}

export type DueTone = "bad" | "warn" | "neutral" | "ok";
/** How a due date reads next to a task. Closed tasks never show as overdue. */
export function dueInfo(due: string | null, today: string, closed = false): { label: string; tone: DueTone } {
  if (!due) return { label: "No due date", tone: "neutral" };
  const n = diffDays(due, today);
  if (closed) return { label: fmtDay(due), tone: "neutral" };
  if (n < 0) return { label: n === -1 ? "Overdue by 1 day" : `Overdue by ${-n} days`, tone: "bad" };
  if (n === 0) return { label: "Due today", tone: "warn" };
  if (n === 1) return { label: "Due tomorrow", tone: "neutral" };
  if (n < 7) return { label: `Due ${fmtDay(due)}`, tone: "neutral" };
  return { label: fmtDay(due), tone: "neutral" };
}
