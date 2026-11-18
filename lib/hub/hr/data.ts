import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSealed, open, UNREADABLE, type SealedField } from "../field-crypto";
import { DEFAULT_SETTINGS, isClock, isEmployment, isLeaveKind, isLeaveStatus, isWorkdays, type HrSettings, type Leave, type Person } from "./model";

// Reads for the people side of Team. Service role only: every caller has already checked the person's access. Sealed columns are
// opened here and nowhere else, and a value that cannot be opened reads as empty (and is logged by field-crypto), never as scrambled text.

const db = () => createSupabaseAdminClient();

const openText = (brandId: string, field: SealedField, stored: unknown) => {
  if (typeof stored !== "string" || !stored || !isSealed(stored)) return "";
  const plain = open(brandId, field, stored);
  return plain === UNREADABLE ? "" : plain;
};

export const getSettings = cache(async (brandId: string): Promise<HrSettings> => {
  const { data } = await db().from("hr_settings").select("work_start, late_after_min, workdays, leave_days").eq("brand_id", brandId).maybeSingle();
  if (!data) return { ...DEFAULT_SETTINGS };
  return {
    workStart: isClock(data.work_start) ? data.work_start : DEFAULT_SETTINGS.workStart,
    lateAfterMin: Number.isInteger(data.late_after_min) ? (data.late_after_min as number) : DEFAULT_SETTINGS.lateAfterMin,
    workdays: isWorkdays(data.workdays) ? data.workdays : DEFAULT_SETTINGS.workdays,
    leaveDays: Number.isInteger(data.leave_days) ? (data.leave_days as number) : DEFAULT_SETTINGS.leaveDays,
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

/** Clock-ins of the brand from `sinceIso` on, oldest first, for the attendance report. */
export async function listClockIns(brandId: string, sinceIso: string, untilIso: string, userId?: string): Promise<{ user_id: string; clock_in: string; clock_out: string | null }[]> {
  let q = db().from("time_entries").select("user_id, clock_in, clock_out").eq("brand_id", brandId).gte("clock_in", sinceIso).lt("clock_in", untilIso);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q.order("clock_in").limit(5000);
  return (data ?? []) as { user_id: string; clock_in: string; clock_out: string | null }[];
}
