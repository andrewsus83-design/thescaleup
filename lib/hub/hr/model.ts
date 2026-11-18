// Pure rules for the people side of Team: people records, leave, attendance, pay and payslips. No I/O, so the browser can import it
// and the sums are easy to test.
//
// Money is kept in hundredths of the currency unit (whole numbers), so adding up never drifts. The hub does NOT know any country's
// tax law: a brand sets its own pay rules (a fixed amount, or a percentage of base or gross pay with an optional ceiling) and the hub
// only does the arithmetic. Whoever sets a rule owns the number.

import { addDays, dayIn, isIsoDate, isMonthKey, weekdayMon0 } from "../tasks/dates";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

// ---------------------------------------------------------------------------------------------- money
export const CURRENCIES = ["IDR", "USD", "SGD", "MYR", "PHP", "THB", "VND", "INR", "AUD", "EUR", "GBP", "JPY", "KRW", "CNY", "HKD", "AED", "SAR", "CAD"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const isCurrency = (v: unknown): v is Currency => typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);

/** Currencies that are not written with cents. A percentage result is rounded to a whole unit for these. */
const WHOLE_UNIT = new Set<string>(["IDR", "VND", "JPY", "KRW"]);
const step = (currency: string) => (WHOLE_UNIT.has(currency) ? 100 : 1);

/** The most one amount can be: a trillion units. Far above any pay, and far below where whole numbers stop being exact. */
export const MAX_CENTS = 1_000_000_000_000 * 100;

/**
 * An amount as a person types it, in hundredths. Reads both "12.000.000" and "12,000,000", and "1,250.50" and "1.250,50".
 * One lone separator followed by exactly three digits is read as thousands ("1.500" is one thousand five hundred). null when it is not an amount.
 */
export function parseMoney(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const s = input.replace(/[\s ]/g, "");
  if (!s || !/^\d[\d.,]*$/.test(s) || /[.,]$/.test(s)) return null;
  const dots = (s.match(/\./g) ?? []).length;
  const commas = (s.match(/,/g) ?? []).length;
  let whole = s;
  let frac = "";
  const split = (sep: string) => {
    const i = s.lastIndexOf(sep);
    whole = s.slice(0, i);
    frac = s.slice(i + 1);
  };
  if (dots > 0 && commas > 0) split(s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",");
  else if (dots + commas === 1) {
    const sep = dots ? "." : ",";
    const after = s.length - s.lastIndexOf(sep) - 1;
    if (after !== 3) split(sep);
  }
  if (frac.length > 2 || /[.,]/.test(frac)) return null;
  const groups = whole.split(/[.,]/);
  // Thousands groups are three digits; the Indian way of writing (12,00,000) has groups of two before the last one.
  if (groups.length > 1 && (groups[0].length > 3 || groups[0].length === 0 || groups.slice(1).some((g, i, rest) => (i === rest.length - 1 ? g.length !== 3 : g.length !== 2 && g.length !== 3)))) return null;
  const digits = groups.join("");
  if (!digits || digits.length > 13) return null;
  const cents = Number(digits) * 100 + Number(frac.padEnd(2, "0") || "0");
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : null;
}

/** An amount for reading, with its currency. */
export function fmtMoney(cents: number, currency: string): string {
  const whole = WHOLE_UNIT.has(currency) || cents % 100 === 0;
  try {
    return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", { style: "currency", currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
}

/** An amount for an input field: plain digits, no currency, so it can be typed over. */
export const moneyInput = (cents: number) => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));

// ---------------------------------------------------------------------------------------------- pay lines and rules
export type LineKind = "earning" | "deduction";
export type PayLine = { label: string; kind: LineKind; mode: "fixed" | "percent"; amount: number; rate: number; of: "base" | "gross"; cap: number | null };
export type Pay = { base: number; lines: PayLine[] };
export type SlipLine = { label: string; kind: LineKind; amount: number; note: string };
export type SlipBody = { name: string; title: string; lines: SlipLine[] };

export const LIMITS = { name: 120, title: 120, label: 60, note: 120, lines: 20, rules: 20, slipLines: 40, reason: 500, emergency: 300 } as const;
export const EMPTY_PAY: Pay = { base: 0, lines: [] };

const isKind = (v: unknown): v is LineKind => v === "earning" || v === "deduction";
const cleanRate = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 100 ? Math.round(v * 1000) / 1000 : null);
const cleanCents = (v: unknown) => (typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= MAX_CENTS ? v : null);

/** Pay lines as they were stored. Anything that is not a line is dropped, so a damaged value can never crash a page. */
export function readLines(raw: unknown, max: number = LIMITS.lines): PayLine[] {
  if (!Array.isArray(raw)) return [];
  const out: PayLine[] = [];
  for (const r of raw) {
    if (out.length >= max || !isObj(r) || !isKind(r.kind)) continue;
    const label = text(r.label, LIMITS.label);
    if (!label) continue;
    if (r.mode === "percent") {
      const rate = cleanRate(r.rate);
      if (rate === null) continue;
      // A percentage that adds to pay is always of base pay: one of gross would feed on itself.
      out.push({ label, kind: r.kind, mode: "percent", amount: 0, rate, of: r.kind === "deduction" && r.of === "gross" ? "gross" : "base", cap: r.cap === null || r.cap === undefined ? null : cleanCents(r.cap) || null });
    } else {
      const amount = cleanCents(r.amount);
      if (amount === null) continue;
      out.push({ label, kind: r.kind, mode: "fixed", amount, rate: 0, of: "base", cap: null });
    }
  }
  return out;
}

export function readPay(raw: unknown): Pay {
  if (!isObj(raw)) return { base: 0, lines: [] };
  return { base: cleanCents(raw.base) ?? 0, lines: readLines(raw.lines) };
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Pay lines as the form sends them: amounts and rates are still the text the person typed. Every line is checked and the first problem
 * is named, so nothing is saved half-read. `allowPercent` is off where only plain amounts make sense (a payslip being corrected).
 */
export function parseLinesInput(json: unknown, max: number, allowPercent = true): Parsed<PayLine[]> {
  let raw: unknown;
  try {
    raw = typeof json === "string" ? JSON.parse(json || "[]") : null;
  } catch {
    raw = null;
  }
  if (!Array.isArray(raw)) return { ok: false, error: "Those lines could not be read. Try again." };
  if (raw.length > max) return { ok: false, error: `That is more than ${max} lines.` };
  const out: PayLine[] = [];
  for (const [i, r] of raw.entries()) {
    const n = `Line ${i + 1}`;
    if (!isObj(r) || !isKind(r.kind)) return { ok: false, error: `${n} could not be read.` };
    const label = text(r.label, LIMITS.label);
    const amountText = typeof r.amount === "string" ? r.amount.trim() : "";
    const rateText = typeof r.rate === "string" ? r.rate.trim() : "";
    // A row left completely empty is not a line.
    if (!label && !amountText && !rateText) continue;
    if (!label) return { ok: false, error: `${n} needs a name.` };
    if (r.mode === "percent") {
      if (!allowPercent) return { ok: false, error: `${n} must be an amount.` };
      const rate = cleanRate(Number(rateText.replace(",", ".")));
      if (rate === null || !/^\d{1,3}([.,]\d{1,3})?$/.test(rateText)) return { ok: false, error: `${n}: the percentage must be more than 0 and at most 100.` };
      const capText = typeof r.cap === "string" ? r.cap.trim() : "";
      const cap = capText ? parseMoney(capText) : null;
      if (capText && !cap) return { ok: false, error: `${n}: the ceiling is not an amount.` };
      out.push({ label, kind: r.kind, mode: "percent", amount: 0, rate, of: r.kind === "deduction" && r.of === "gross" ? "gross" : "base", cap });
    } else {
      const amount = parseMoney(amountText);
      if (amount === null) return { ok: false, error: `${n}: "${amountText.slice(0, 20)}" is not an amount.` };
      out.push({ label, kind: r.kind, mode: "fixed", amount, rate: 0, of: "base", cap: null });
    }
  }
  return { ok: true, value: out };
}

const pct = (basis: number, line: PayLine, currency: string) => {
  const s = step(currency);
  return Math.round((Math.min(basis, line.cap ?? basis) * line.rate) / 100 / s) * s;
};
const rateNote = (line: PayLine, currency: string) => `${line.rate}% of ${line.of === "gross" ? "gross pay" : "base pay"}${line.cap ? `, on at most ${fmtMoney(line.cap, currency)}` : ""}`;

/**
 * One person's payslip lines for a month: base pay, what is added, then what is taken off. The person's own lines come before the
 * brand's rules. Additions are worked out first, because a deduction can be a percentage of gross pay (base plus additions).
 */
export function computeSlip(pay: Pay, rules: readonly PayLine[], currency: string): SlipLine[] {
  const all = [...pay.lines, ...rules];
  const out: SlipLine[] = [{ label: "Base pay", kind: "earning", amount: pay.base, note: "" }];
  for (const l of all) {
    if (l.kind !== "earning") continue;
    const amount = l.mode === "fixed" ? l.amount : pct(pay.base, l, currency);
    if (amount > 0) out.push({ label: l.label, kind: "earning", amount, note: l.mode === "percent" ? rateNote(l, currency) : "" });
  }
  const gross = out.reduce((a, l) => a + l.amount, 0);
  for (const l of all) {
    if (l.kind !== "deduction") continue;
    const amount = l.mode === "fixed" ? l.amount : pct(l.of === "gross" ? gross : pay.base, l, currency);
    if (amount > 0) out.push({ label: l.label, kind: "deduction", amount, note: l.mode === "percent" ? rateNote(l, currency) : "" });
  }
  return out;
}

/** A payslip's lines as the correction form sends them: plain amounts only. A payslip always keeps at least one line of pay. */
export function parseSlipLinesInput(json: unknown): Parsed<SlipLine[]> {
  let raw: unknown;
  try {
    raw = typeof json === "string" ? JSON.parse(json || "[]") : null;
  } catch {
    raw = null;
  }
  if (!Array.isArray(raw)) return { ok: false, error: "Those lines could not be read. Try again." };
  if (raw.length > LIMITS.slipLines) return { ok: false, error: `That is more than ${LIMITS.slipLines} lines.` };
  const out: SlipLine[] = [];
  for (const [i, r] of raw.entries()) {
    const n = `Line ${i + 1}`;
    if (!isObj(r) || !isKind(r.kind)) return { ok: false, error: `${n} could not be read.` };
    const label = text(r.label, LIMITS.label);
    const amountText = typeof r.amount === "string" ? r.amount.trim() : "";
    if (!label && !amountText) continue;
    if (!label) return { ok: false, error: `${n} needs a name.` };
    const amount = parseMoney(amountText);
    if (amount === null) return { ok: false, error: `${n}: "${amountText.slice(0, 20)}" is not an amount.` };
    out.push({ label, kind: r.kind, amount, note: text(r.note, LIMITS.note) });
  }
  if (!out.some((l) => l.kind === "earning")) return { ok: false, error: "A payslip needs at least one line of pay." };
  return { ok: true, value: out };
}

export type Totals = { gross: number; deductions: number; net: number };
export function totals(lines: readonly SlipLine[]): Totals {
  let gross = 0;
  let deductions = 0;
  for (const l of lines) {
    if (l.kind === "earning") gross += l.amount;
    else deductions += l.amount;
  }
  return { gross, deductions, net: gross - deductions };
}

/** A stored payslip. Damaged lines are dropped; a slip that cannot be read at all comes back with no lines. */
export function readSlip(raw: unknown): SlipBody {
  if (!isObj(raw)) return { name: "", title: "", lines: [] };
  const lines: SlipLine[] = [];
  for (const r of Array.isArray(raw.lines) ? raw.lines : []) {
    if (lines.length >= LIMITS.slipLines || !isObj(r) || !isKind(r.kind)) continue;
    const amount = cleanCents(r.amount);
    const label = text(r.label, LIMITS.label);
    if (amount === null || !label) continue;
    lines.push({ label, kind: r.kind, amount, note: text(r.note, LIMITS.note) });
  }
  return { name: text(raw.name, LIMITS.name), title: text(raw.title, LIMITS.title), lines };
}

// ---------------------------------------------------------------------------------------------- settings
export type HrSettings = { currency: Currency; workStart: string; lateAfterMin: number; workdays: 5 | 6 | 7; leaveDays: number; rules: PayLine[] };
export const DEFAULT_SETTINGS: HrSettings = { currency: "IDR", workStart: "09:00", lateAfterMin: 15, workdays: 5, leaveDays: 12, rules: [] };
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

// ---------------------------------------------------------------------------------------------- who may do what
export type RunStatus = "draft" | "final";
export type Run = { id: string; month: string; status: RunStatus; currency: string; createdAt: string; finalizedAt: string | null };
