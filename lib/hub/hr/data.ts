import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSealed, open, UNREADABLE, type SealedField } from "../field-crypto";
import {
  DEFAULT_SETTINGS,
  isClock,
  isCurrency,
  isEmployment,
  isLeaveKind,
  isLeaveStatus,
  isWorkdays,
  LIMITS,
  readLines,
  readPay,
  readSlip,
  type HrSettings,
  type Leave,
  type Pay,
  type Person,
  type Run,
  type SlipBody,
} from "./model";

// Reads for the people side of Team. Service role only: every caller has already checked the person's access. Sealed columns are
// opened here and nowhere else, and a value that cannot be opened reads as empty (and is logged by field-crypto), never as scrambled text.

const db = () => createSupabaseAdminClient();

function openJson(brandId: string, field: SealedField, stored: unknown): unknown {
  if (typeof stored !== "string" || !stored) return null;
  // These columns are only ever written sealed. Plain text in one is not ours to trust.
  if (!isSealed(stored)) return null;
  const plain = open(brandId, field, stored);
  if (plain === UNREADABLE) return null;
  try {
    return JSON.parse(plain) as unknown;
  } catch {
    return null;
  }
}
const openText = (brandId: string, field: SealedField, stored: unknown) => {
  if (typeof stored !== "string" || !stored || !isSealed(stored)) return "";
  const plain = open(brandId, field, stored);
  return plain === UNREADABLE ? "" : plain;
};

export const getSettings = cache(async (brandId: string): Promise<HrSettings> => {
  const { data } = await db().from("hr_settings").select("currency, work_start, late_after_min, workdays, leave_days, rules_sealed").eq("brand_id", brandId).maybeSingle();
  if (!data) return { ...DEFAULT_SETTINGS };
  return {
    currency: isCurrency(data.currency) ? data.currency : DEFAULT_SETTINGS.currency,
    workStart: isClock(data.work_start) ? data.work_start : DEFAULT_SETTINGS.workStart,
    lateAfterMin: Number.isInteger(data.late_after_min) ? (data.late_after_min as number) : DEFAULT_SETTINGS.lateAfterMin,
    workdays: isWorkdays(data.workdays) ? data.workdays : DEFAULT_SETTINGS.workdays,
    leaveDays: Number.isInteger(data.leave_days) ? (data.leave_days as number) : DEFAULT_SETTINGS.leaveDays,
    rules: readLines(openJson(brandId, "hr_settings.rules", data.rules_sealed), LIMITS.rules),
  };
});

const PERSON_COLS = "id, user_id, full_name, job_title, employment, start_date, end_date, status, leave_days";
type PersonRow = { id: string; user_id: string | null; full_name: string; job_title: string; employment: string; start_date: string | null; end_date: string | null; status: string; leave_days: number | null };
const toPerson = (r: PersonRow): Person => ({
  id: r.id,
  userId: r.user_id,
  name: r.full_name,
  title: r.job_title,
  employment: isEmployment(r.employment) ? r.employment : "full_time",
  startDate: r.start_date,
  endDate: r.end_date,
  status: r.status === "left" ? "left" : "active",
  leaveDays: r.leave_days,
});

export const listPeople = cache(async (brandId: string): Promise<Person[]> => {
  const { data } = await db().from("hr_people").select(PERSON_COLS).eq("brand_id", brandId).order("full_name").limit(500);
  return ((data ?? []) as PersonRow[]).map(toPerson);
});

export async function getPerson(brandId: string, personId: string): Promise<Person | null> {
  const { data } = await db().from("hr_people").select(PERSON_COLS).eq("brand_id", brandId).eq("id", personId).maybeSingle();
  return data ? toPerson(data as PersonRow) : null;
}

/** The record that belongs to this sign-in, if the brand linked one. */
export const personForUser = cache(async (brandId: string, userId: string): Promise<Person | null> => {
  const { data } = await db().from("hr_people").select(PERSON_COLS).eq("brand_id", brandId).eq("user_id", userId).maybeSingle();
  return data ? toPerson(data as PersonRow) : null;
});

/** The emergency contact and notes of one person. Only for the person themself and whoever manages the team. */
export async function getPrivate(brandId: string, personId: string): Promise<string> {
  const { data } = await db().from("hr_people").select("private_sealed").eq("brand_id", brandId).eq("id", personId).maybeSingle();
  return openText(brandId, "hr_people.private", data?.private_sealed);
}

/** What one person is paid every month. Only behind the Salary and payroll access. */
export async function getPay(brandId: string, personId: string): Promise<Pay> {
  const { data } = await db().from("hr_people").select("pay_sealed").eq("brand_id", brandId).eq("id", personId).maybeSingle();
  return readPay(openJson(brandId, "hr_people.pay", data?.pay_sealed));
}

/** Everyone's monthly pay at once, for a payroll run. Only behind the Salary and payroll access. */
export async function listPay(brandId: string): Promise<Map<string, Pay>> {
  const { data } = await db().from("hr_people").select("id, pay_sealed").eq("brand_id", brandId).limit(500);
  const out = new Map<string, Pay>();
  for (const r of data ?? []) if (r.pay_sealed) out.set(r.id as string, readPay(openJson(brandId, "hr_people.pay", r.pay_sealed)));
  return out;
}

type LeaveRow = { id: string; person_id: string; kind: string; start_date: string; end_date: string; days: number; status: string; note_sealed: string; requested_by: string | null; created_at: string };

/** Leave that touches the time from `since` on, newest first. With `personId`, one person's only. */
export async function listLeave(brandId: string, since: string, personId?: string): Promise<Leave[]> {
  let q = db().from("hr_leave").select("id, person_id, kind, start_date, end_date, days, status, note_sealed, requested_by, created_at").eq("brand_id", brandId).gte("end_date", since);
  if (personId) q = q.eq("person_id", personId);
  const { data } = await q.order("start_date", { ascending: false }).limit(1000);
  return ((data ?? []) as LeaveRow[]).map((r) => ({
    id: r.id,
    personId: r.person_id,
    kind: isLeaveKind(r.kind) ? r.kind : "other",
    start: r.start_date,
    end: r.end_date,
    days: r.days,
    status: isLeaveStatus(r.status) ? r.status : "pending",
    note: openText(brandId, "hr_leave.note", r.note_sealed),
    requestedBy: r.requested_by,
    createdAt: r.created_at,
  }));
}

type RunRow = { id: string; month: string; status: string; currency: string; created_at: string; finalized_at: string | null };
const toRun = (r: RunRow): Run => ({ id: r.id, month: r.month, status: r.status === "final" ? "final" : "draft", currency: r.currency, createdAt: r.created_at, finalizedAt: r.finalized_at });
const RUN_COLS = "id, month, status, currency, created_at, finalized_at";

export async function listRuns(brandId: string): Promise<Run[]> {
  const { data } = await db().from("hr_payroll_runs").select(RUN_COLS).eq("brand_id", brandId).order("month", { ascending: false }).limit(60);
  return ((data ?? []) as RunRow[]).map(toRun);
}

export async function getRun(brandId: string, runId: string): Promise<Run | null> {
  const { data } = await db().from("hr_payroll_runs").select(RUN_COLS).eq("brand_id", brandId).eq("id", runId).maybeSingle();
  return data ? toRun(data as RunRow) : null;
}

export type Slip = { id: string; runId: string; personId: string; body: SlipBody };
type SlipRow = { id: string; run_id: string; person_id: string; body_sealed: string };
const toSlip = (brandId: string, r: SlipRow): Slip => ({ id: r.id, runId: r.run_id, personId: r.person_id, body: readSlip(openJson(brandId, "hr_payslips.body", r.body_sealed)) });

export async function listSlips(brandId: string, runId: string): Promise<Slip[]> {
  const { data } = await db().from("hr_payslips").select("id, run_id, person_id, body_sealed").eq("brand_id", brandId).eq("run_id", runId).limit(500);
  return ((data ?? []) as SlipRow[]).map((r) => toSlip(brandId, r)).sort((a, b) => a.body.name.localeCompare(b.body.name));
}

export async function getSlip(brandId: string, slipId: string): Promise<Slip | null> {
  const { data } = await db().from("hr_payslips").select("id, run_id, person_id, body_sealed").eq("brand_id", brandId).eq("id", slipId).maybeSingle();
  return data ? toSlip(brandId, data as SlipRow) : null;
}

/** One person's payslips from finished runs only, newest month first. A draft is never shown to the person it is about. */
export async function listSlipsOf(brandId: string, personId: string): Promise<{ slip: Slip; run: Run }[]> {
  const [{ data }, runs] = await Promise.all([db().from("hr_payslips").select("id, run_id, person_id, body_sealed").eq("brand_id", brandId).eq("person_id", personId).limit(120), listRuns(brandId)]);
  const byId = new Map(runs.filter((r) => r.status === "final").map((r) => [r.id, r]));
  return ((data ?? []) as SlipRow[])
    .filter((r) => byId.has(r.run_id))
    .map((r) => ({ slip: toSlip(brandId, r), run: byId.get(r.run_id)! }))
    .sort((a, b) => b.run.month.localeCompare(a.run.month));
}

/** Clock-ins of the brand from `sinceIso` on, oldest first, for the attendance report. */
export async function listClockIns(brandId: string, sinceIso: string, untilIso: string, userId?: string): Promise<{ user_id: string; clock_in: string; clock_out: string | null }[]> {
  let q = db().from("time_entries").select("user_id, clock_in, clock_out").eq("brand_id", brandId).gte("clock_in", sinceIso).lt("clock_in", untilIso);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q.order("clock_in").limit(5000);
  return (data ?? []) as { user_id: string; clock_in: string; clock_out: string | null }[];
}
