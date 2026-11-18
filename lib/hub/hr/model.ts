// Pure rules for the people side of Team: people records, leave and attendance. No I/O, so the browser can import it and the
// counting is easy to test. Salary and payroll are not part of this yet.

import { addDays, dayIn, isIsoDate, isMonthKey, weekdayMon0 } from "../tasks/dates";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export const LIMITS = { name: 120, title: 120, reason: 500, emergency: 300 } as const;
type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

// ---------------------------------------------------------------------------------------------- settings
export type HrSettings = { workStart: string; lateAfterMin: number; workdays: 5 | 6 | 7; leaveDays: number };
export const DEFAULT_SETTINGS: HrSettings = { workStart: "09:00", lateAfterMin: 15, workdays: 5, leaveDays: 12 };
export const WORKDAYS_LABEL: Record<5 | 6 | 7, string> = { 5: "Monday to Friday", 6: "Monday to Saturday", 7: "Every day" };
export const isClock = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const isWorkdays = (v: unknown): v is 5 | 6 | 7 => v === 5 || v === 6 || v === 7;
const wholeIn = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null);

// ---------------------------------------------------------------------------------------------- people
export const EMPLOYMENT = ["full_time", "part_time", "contract", "intern", "freelance"] as const;
export type Employment = (typeof EMPLOYMENT)[number];
export const EMPLOYMENT_LABEL: Record<Employment, string> = { full_time: "Full time", part_time: "Part time", contract: "Contract", intern: "Intern", freelance: "Freelance" };
export const isEmployment = (v: unknown): v is Employment => typeof v === "string" && (EMPLOYMENT as readonly string[]).includes(v);

export type Person = {
  id: string;
  userId: string | null;
  name: string;
  title: string;
  employment: Employment;
  startDate: string | null;
  endDate: string | null;
  status: "active" | "left";
  leaveDays: number | null;
};

export type PersonInput = { name: string; title: string; employment: Employment; startDate: string | null; endDate: string | null; leaveDays: number | null; emergency: string };

export function parsePersonInput(v: Record<string, string>): Parsed<PersonInput> {
  const name = text(v.name, LIMITS.name);
  if (!name) return { ok: false, error: "Type the person's name." };
  if (!isEmployment(v.employment)) return { ok: false, error: "Choose the kind of employment." };
  const day = (s: string | undefined, what: string): Parsed<string | null> => (!s ? { ok: true, value: null } : isIsoDate(s) ? { ok: true, value: s } : { ok: false, error: `The ${what} is not a date.` });
  const start = day(v.startDate, "start date");
  if (!start.ok) return start;
  const end = day(v.endDate, "end date");
  if (!end.ok) return end;
  if (start.value && end.value && end.value < start.value) return { ok: false, error: "The end date is before the start date." };
  let leaveDays: number | null = null;
  if (v.leaveDays?.trim()) {
    leaveDays = wholeIn(Number(v.leaveDays), 0, 365);
    if (leaveDays === null || !/^\d{1,3}$/.test(v.leaveDays.trim())) return { ok: false, error: "Leave days a year must be a whole number from 0 to 365." };
  }
  return { ok: true, value: { name, title: text(v.title, LIMITS.title), employment: v.employment, startDate: start.value, endDate: end.value, leaveDays, emergency: typeof v.emergency === "string" ? v.emergency.trim().slice(0, LIMITS.emergency) : "" } };
}

// ---------------------------------------------------------------------------------------------- leave
export const LEAVE_KINDS = ["annual", "sick", "unpaid", "other"] as const;
export type LeaveKind = (typeof LEAVE_KINDS)[number];
export const LEAVE_LABEL: Record<LeaveKind, string> = { annual: "Annual leave", sick: "Sick leave", unpaid: "Unpaid leave", other: "Other" };
export const isLeaveKind = (v: unknown): v is LeaveKind => typeof v === "string" && (LEAVE_KINDS as readonly string[]).includes(v);
export const LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];
export const isLeaveStatus = (v: unknown): v is LeaveStatus => typeof v === "string" && (LEAVE_STATUSES as readonly string[]).includes(v);

export type Leave = { id: string; personId: string; kind: LeaveKind; start: string; end: string; days: number; status: LeaveStatus; note: string; requestedBy: string | null; createdAt: string };

const isWorkday = (iso: string, workdays: number) => weekdayMon0(iso) < workdays;

/** Working days from `start` to `end`, both included. Public holidays are not known to the hub, so they count as working days. */
export function countWorkdays(start: string, end: string, workdays: number): number {
  let n = 0;
  for (let d = start, i = 0; d <= end && i < 400; d = addDays(d, 1), i++) if (isWorkday(d, workdays)) n++;
  return n;
}

export const MAX_LEAVE_SPAN = 120; // calendar days in one request

export function checkLeave(start: unknown, end: unknown, workdays: number): Parsed<{ start: string; end: string; days: number }> {
  if (!isIsoDate(start) || !isIsoDate(end)) return { ok: false, error: "Choose the first and the last day." };
  if (end < start) return { ok: false, error: "The last day is before the first day." };
  if (addDays(start, MAX_LEAVE_SPAN) < end) return { ok: false, error: `One request covers at most ${MAX_LEAVE_SPAN} days. Split it in two.` };
  const days = countWorkdays(start, end, workdays);
  if (days === 0) return { ok: false, error: "Those dates have no working days in them." };
  return { ok: true, value: { start, end, days } };
}

export type Balance = { allowance: number; used: number; pending: number; left: number };

/** Annual leave for one person in one calendar year. A request counts in the year it starts. Only annual leave uses the allowance. */
export function leaveBalance(leaves: readonly Pick<Leave, "personId" | "kind" | "start" | "days" | "status">[], personId: string, year: string, allowance: number): Balance {
  let used = 0;
  let pending = 0;
  for (const l of leaves) {
    if (l.personId !== personId || l.kind !== "annual" || l.start.slice(0, 4) !== year) continue;
    if (l.status === "approved") used += l.days;
    else if (l.status === "pending") pending += l.days;
  }
  return { allowance, used, pending, left: allowance - used };
}

/** Whether two requests of one person share a day. Rejected and cancelled ones are out of the way. */
export function overlapsLeave(leaves: readonly Pick<Leave, "personId" | "start" | "end" | "status">[], personId: string, start: string, end: string): boolean {
  return leaves.some((l) => l.personId === personId && (l.status === "pending" || l.status === "approved") && l.start <= end && l.end >= start);
}

// ---------------------------------------------------------------------------------------------- attendance
export const lastDayOf = (month: string) => `${month}-${String(new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate()).padStart(2, "0")}`;

/** Minutes after midnight in `tz` at `at`. */
export function minuteOfDay(at: string | Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(typeof at === "string" ? new Date(at) : at);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return n("hour") * 60 + n("minute");
}

export type Attendance = { present: number; late: number; onLeave: number; noClockIn: number; minutes: number };

/**
 * One person's month from their clock-ins. "Late" is a first clock-in of the day after the start time plus the grace minutes.
 * "No clock-in" counts working days before today with neither a clock-in nor approved leave: it is a prompt to ask, not a verdict,
 * because the hub knows no public holidays and people forget to clock in.
 */
export function attendanceFor(o: {
  clockIns: readonly { clock_in: string; clock_out: string | null }[];
  month: string;
  today: string;
  tz: string;
  settings: Pick<HrSettings, "workStart" | "lateAfterMin" | "workdays">;
  leave: readonly { start: string; end: string }[];
  startDate: string | null;
  endDate: string | null;
}): Attendance {
  const zero: Attendance = { present: 0, late: 0, onLeave: 0, noClockIn: 0, minutes: 0 };
  if (!isMonthKey(o.month)) return zero;
  let from = `${o.month}-01`;
  let to = lastDayOf(o.month);
  if (o.startDate && o.startDate > from) from = o.startDate;
  if (o.endDate && o.endDate < to) to = o.endDate;
  if (to > o.today) to = o.today;
  if (from > to) return zero;

  const first = new Map<string, number>(); // day -> earliest clock-in, minutes after midnight
  let minutes = 0;
  for (const e of o.clockIns) {
    const day = dayIn(o.tz, e.clock_in);
    if (day < from || day > to) continue;
    const m = minuteOfDay(e.clock_in, o.tz);
    first.set(day, Math.min(first.get(day) ?? 1440, m));
    if (e.clock_out) {
      const span = (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 60_000;
      if (span > 0 && span <= 16 * 60) minutes += span;
    }
  }
  const startMin = Number(o.settings.workStart.slice(0, 2)) * 60 + Number(o.settings.workStart.slice(3, 5)) + o.settings.lateAfterMin;
  let late = 0;
  for (const m of first.values()) if (m > startMin) late++;

  let onLeave = 0;
  let noClockIn = 0;
  for (let d = from, i = 0; d <= to && i < 40; d = addDays(d, 1), i++) {
    if (!isWorkday(d, o.settings.workdays) || first.has(d)) continue;
    if (o.leave.some((l) => l.start <= d && l.end >= d)) onLeave++;
    else if (d < o.today) noClockIn++;
  }
  return { present: first.size, late, onLeave, noClockIn, minutes: Math.round(minutes) };
}
