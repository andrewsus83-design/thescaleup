// Pure rules for Finance, simple books: money in, money out, invoices and the monthly totals. No I/O, so the browser can import it
// and the sums are easy to test. This is a cash book for running the business, not formal accounting: there are no journals, no
// balance sheet and no tax. The accountant's books stay with the accountant.

import { parseMoney } from "../money";
import { isIsoDate, isMonthKey, shiftMonth } from "../tasks/dates";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export const LIMITS = { category: 40, note: 300, number: 40, client: 120, list: 200 } as const;
export type EntryKind = "in" | "out";
export const isEntryKind = (v: unknown): v is EntryKind => v === "in" || v === "out";
export const KIND_LABEL: Record<EntryKind, string> = { in: "Money in", out: "Money out" };

/** Suggestions only: a brand can type any category. */
export const CATEGORIES: Record<EntryKind, readonly string[]> = {
  in: ["Sales", "Services", "Commission", "Other income"],
  out: ["Salaries", "Rent", "Marketing and ads", "Software and tools", "Supplies", "Transport", "Tax", "Other"],
};

export type Entry = { id: string; kind: EntryKind; day: string; amount: number; category: string; note: string; invoiceId: string | null };
export type EntryInput = { kind: EntryKind; day: string; amount: number; category: string; note: string };

/** How far from today an entry's date can be: ten years back, one year ahead. Catches a mistyped year. */
const dayInRange = (day: string, today: string) => day >= `${Number(today.slice(0, 4)) - 10}-01-01` && day <= `${Number(today.slice(0, 4)) + 1}-12-31`;

export function parseEntryInput(v: Record<string, string>, today: string): Parsed<EntryInput> {
  if (!isEntryKind(v.kind)) return { ok: false, error: "Choose money in or money out." };
  if (!isIsoDate(v.day)) return { ok: false, error: "Choose the date." };
  if (!dayInRange(v.day, today)) return { ok: false, error: "That date is too far from today. Check the year." };
  const amount = parseMoney(v.amount ?? "");
  if (amount === null) return { ok: false, error: "That is not an amount. Type it like 1.500.000 or 1,500,000." };
  if (amount === 0) return { ok: false, error: "The amount must be more than zero." };
  const category = text(v.category, LIMITS.category);
  if (!category) return { ok: false, error: "Choose or type a category." };
  return { ok: true, value: { kind: v.kind, day: v.day, amount, category, note: text(v.note, LIMITS.note) } };
}

// ---------------------------------------------------------------------------------------------- invoices
export type InvoiceStatus = "unpaid" | "paid" | "void";
export const isInvoiceStatus = (v: unknown): v is InvoiceStatus => v === "unpaid" || v === "paid" || v === "void";
export type Invoice = { id: string; number: string; client: string; issued: string; due: string; amount: number; status: InvoiceStatus; paidOn: string | null; note: string };
export type InvoiceInput = { number: string; client: string; issued: string; due: string; amount: number; note: string };

export function parseInvoiceInput(v: Record<string, string>, today: string): Parsed<InvoiceInput> {
  const number = text(v.number, LIMITS.number);
  if (!number) return { ok: false, error: "Type the invoice number." };
  const client = text(v.client, LIMITS.client);
  if (!client) return { ok: false, error: "Type who the invoice is for." };
  if (!isIsoDate(v.issued) || !isIsoDate(v.due)) return { ok: false, error: "Choose the invoice date and the due date." };
  if (!dayInRange(v.issued, today) || !dayInRange(v.due, today)) return { ok: false, error: "Those dates are too far from today. Check the year." };
  if (v.due < v.issued) return { ok: false, error: "The due date is before the invoice date." };
  const amount = parseMoney(v.amount ?? "");
  if (amount === null) return { ok: false, error: "That is not an amount. Type it like 1.500.000 or 1,500,000." };
  if (amount === 0) return { ok: false, error: "The amount must be more than zero." };
  return { ok: true, value: { number, client, issued: v.issued, due: v.due, amount, note: text(v.note, LIMITS.note) } };
}

/** A payment date for an invoice: not before the invoice was written, not in the future. */
export function checkPaidOn(paidOn: unknown, issued: string, today: string): Parsed<string> {
  if (!isIsoDate(paidOn)) return { ok: false, error: "Choose the day it was paid." };
  if (paidOn > today) return { ok: false, error: "The payment date is in the future." };
  if (paidOn < issued) return { ok: false, error: "The payment date is before the invoice date." };
  return { ok: true, value: paidOn };
}

export const isOverdue = (inv: Pick<Invoice, "status" | "due">, today: string) => inv.status === "unpaid" && inv.due < today;

export type Owed = { unpaid: number; unpaidCount: number; overdue: number; overdueCount: number };
/** What clients still owe: every unpaid invoice, and the part of it that is past its due date. */
export function owed(invoices: readonly Pick<Invoice, "status" | "due" | "amount">[], today: string): Owed {
  const o: Owed = { unpaid: 0, unpaidCount: 0, overdue: 0, overdueCount: 0 };
  for (const i of invoices) {
    if (i.status !== "unpaid") continue;
    o.unpaid += i.amount;
    o.unpaidCount++;
    if (i.due < today) {
      o.overdue += i.amount;
      o.overdueCount++;
    }
  }
  return o;
}

/** The next number after the highest one that ends in digits, e.g. INV-2026-007 gives INV-2026-008. A first invoice gets INV-<year>-001. */
export function nextNumber(numbers: readonly string[], year: string): string {
  let best: { head: string; n: number; width: number } | null = null;
  for (const num of numbers) {
    const m = /^(.*?)(\d{1,9})$/.exec(num.trim());
    if (m && (!best || Number(m[2]) > best.n)) best = { head: m[1], n: Number(m[2]), width: m[2].length };
  }
  return best ? `${best.head}${String(best.n + 1).padStart(best.width, "0")}`.slice(0, LIMITS.number) : `INV-${year}-001`;
}

// ---------------------------------------------------------------------------------------------- totals
/** One row of the database's monthly totals. */
export type TotalRow = { month: string; kind: EntryKind; category: string; total: number; entries: number };

export function readTotals(raw: unknown): TotalRow[] {
  const out: TotalRow[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    if (typeof r !== "object" || r === null) continue;
    const o = r as Record<string, unknown>;
    const total = Number(o.total);
    const entries = Number(o.entries);
    if (!isMonthKey(o.month) || !isEntryKind(o.kind) || typeof o.category !== "string" || !Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(entries)) continue;
    out.push({ month: o.month, kind: o.kind, category: o.category, total, entries });
  }
  return out;
}

export type MonthSum = { month: string; in: number; out: number; net: number; entries: number };

/** In, out and what is left for each month from `from` to `to`, oldest first. A month with nothing in it is still listed, as zeros. */
export function monthSeries(rows: readonly TotalRow[], from: string, to: string): MonthSum[] {
  const by = new Map<string, MonthSum>();
  for (let m = from, i = 0; m <= to && i < 120; m = shiftMonth(m, 1), i++) by.set(m, { month: m, in: 0, out: 0, net: 0, entries: 0 });
  for (const r of rows) {
    const s = by.get(r.month);
    if (!s) continue;
    s[r.kind] += r.total;
    s.entries += r.entries;
  }
  for (const s of by.values()) s.net = s.in - s.out;
  return [...by.values()];
}

export type CategorySum = { category: string; total: number; share: number };

/** One month's categories of one kind, biggest first, with each one's share of the total (0 to 100, whole percent). */
export function byCategory(rows: readonly TotalRow[], month: string, kind: EntryKind): CategorySum[] {
  // "sales" and "Sales" are one category: the first spelling seen is the one shown.
  const merged = new Map<string, { category: string; total: number }>();
  for (const r of rows) {
    if (r.month !== month || r.kind !== kind) continue;
    const key = r.category.trim().toLowerCase();
    const cur = merged.get(key);
    if (cur) cur.total += r.total;
    else merged.set(key, { category: r.category.trim(), total: r.total });
  }
  const sum = [...merged.values()].reduce((a, r) => a + r.total, 0);
  return [...merged.values()]
    .map((r) => ({ category: r.category, total: r.total, share: sum > 0 ? Math.round((r.total / sum) * 100) : 0 }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
}

// ---------------------------------------------------------------------------------------------- the plan
/** One line of the monthly plan: what the brand expects to bring in, or to spend, in a category. */
export type PlanLine = { kind: EntryKind; category: string; amount: number };
export const MAX_PLAN_LINES = 40;

/** Plan lines as stored. Anything that is not a line is dropped. */
export function readPlan(raw: unknown): PlanLine[] {
  const out: PlanLine[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    if (typeof r !== "object" || r === null) continue;
    const o = r as Record<string, unknown>;
    const amount = Number(o.amount_cents ?? o.amount);
    if (!isEntryKind(o.kind) || typeof o.category !== "string" || !o.category.trim() || !Number.isSafeInteger(amount) || amount <= 0) continue;
    out.push({ kind: o.kind, category: o.category.trim(), amount });
  }
  return out;
}

/**
 * The plan as the form sends it: amounts are still the text the person typed. A row without an amount is skipped (the form offers
 * suggested categories to fill in); an amount without a category, or one that is not an amount, is named. A category is planned once per kind.
 */
export function parsePlanInput(json: unknown): Parsed<PlanLine[]> {
  let raw: unknown;
  try {
    raw = typeof json === "string" ? JSON.parse(json || "[]") : null;
  } catch {
    raw = null;
  }
  if (!Array.isArray(raw)) return { ok: false, error: "The plan could not be read. Try again." };
  if (raw.length > MAX_PLAN_LINES * 2) return { ok: false, error: `A plan has at most ${MAX_PLAN_LINES} lines.` };
  const out: PlanLine[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (typeof r !== "object" || r === null) return { ok: false, error: "The plan could not be read. Try again." };
    const o = r as Record<string, unknown>;
    if (!isEntryKind(o.kind)) return { ok: false, error: "The plan could not be read. Try again." };
    const category = text(o.category, LIMITS.category);
    const amountText = typeof o.amount === "string" ? o.amount.trim() : "";
    if (!category && !amountText) continue;
    const where = o.kind === "in" ? "money in" : "money out";
    if (!category) return { ok: false, error: `A ${where} line has an amount but no category.` };
    // A category with no amount is a suggestion nobody filled in: it is simply not part of the plan.
    if (!amountText) continue;
    const amount = parseMoney(amountText);
    if (amount === null) return { ok: false, error: `${category}: "${amountText.slice(0, 20)}" is not an amount.` };
    if (amount === 0) return { ok: false, error: `${category}: the amount must be more than zero, or remove the line.` };
    const key = `${o.kind}:${category.toLowerCase()}`;
    if (seen.has(key)) return { ok: false, error: `${category} is in the ${where} plan twice.` };
    seen.add(key);
    out.push({ kind: o.kind, category, amount });
  }
  if (out.length > MAX_PLAN_LINES) return { ok: false, error: `A plan has at most ${MAX_PLAN_LINES} lines.` };
  return { ok: true, value: out };
}

/** How a category stands against its plan. For money out, "near" is 80% used and "over" is past the plan; for money in, "over" is good news. */
export type PlanState = "ok" | "near" | "over" | "unplanned";
export type PlanRow = { kind: EntryKind; category: string; plan: number; actual: number; pct: number; left: number; state: PlanState };

/**
 * One month's plan beside what was really entered, per category. Categories match whatever the capitals. A category with entries
 * but no plan is listed as unplanned, so spending outside the plan is never hidden. Planned lines come first, biggest plan first.
 */
export function planVsActual(plan: readonly PlanLine[], totals: readonly TotalRow[], month: string, kind: EntryKind): PlanRow[] {
  const actual = new Map<string, { category: string; total: number }>();
  for (const r of totals) {
    if (r.month !== month || r.kind !== kind) continue;
    const key = r.category.trim().toLowerCase();
    const cur = actual.get(key);
    if (cur) cur.total += r.total;
    else actual.set(key, { category: r.category.trim(), total: r.total });
  }
  const rows: PlanRow[] = [];
  for (const p of plan) {
    if (p.kind !== kind) continue;
    const key = p.category.toLowerCase();
    const got = actual.get(key)?.total ?? 0;
    actual.delete(key);
    const pct = Math.round((got / p.amount) * 100);
    rows.push({ kind, category: p.category, plan: p.amount, actual: got, pct, left: p.amount - got, state: got > p.amount ? "over" : pct >= 80 ? "near" : "ok" });
  }
  rows.sort((a, b) => b.plan - a.plan || a.category.localeCompare(b.category));
  const extra = [...actual.values()].sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
  for (const e of extra) rows.push({ kind, category: e.category, plan: 0, actual: e.total, pct: 0, left: -e.total, state: "unplanned" });
  return rows;
}

/** The same rows with what needs a look first: over the plan, then spending that is not in the plan, then nearly used, then the rest. */
export function needsAttentionFirst(rows: readonly PlanRow[]): PlanRow[] {
  const rank: Record<PlanState, number> = { over: 0, unplanned: 1, near: 2, ok: 3 };
  return rows.map((r, i) => ({ r, i })).sort((a, b) => rank[a.r.state] - rank[b.r.state] || a.i - b.i).map((x) => x.r);
}

export type PlanTotals = { in: number; out: number; net: number };
/** What the plan adds up to for a month: planned in, planned out, and what should be left. */
export function planTotals(plan: readonly PlanLine[]): PlanTotals {
  const t = { in: 0, out: 0, net: 0 };
  for (const p of plan) t[p.kind] += p.amount;
  t.net = t.in - t.out;
  return t;
}

/** How far through the month `today` is, 0 to 100. A past month is 100, a month that has not started is 0. */
export function monthProgress(month: string, today: string): number {
  if (!isMonthKey(month)) return 0;
  const cur = today.slice(0, 7);
  if (month < cur) return 100;
  if (month > cur) return 0;
  const days = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
  return Math.round((Number(today.slice(8, 10)) / days) * 100);
}
