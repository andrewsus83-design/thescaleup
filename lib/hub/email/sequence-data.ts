import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseAudience, type Audience } from "./model";
import { parseSteps, parseStopStages, STOP_REASONS, type SeqStatus, type Step, type StopReason } from "./sequence-model";

// Reads for the sequence pages. They use the service role, so every function takes the brand id and filters on it: the caller has
// already checked that this person may open Mail in this brand.

const db = () => createSupabaseAdminClient();

export const SEQ_MISSING = "42P01"; // Postgres: the table does not exist yet (the database step has not been run)

export type SequenceRow = { id: string; name: string; status: SeqStatus; steps: number; auto_enroll: boolean; updated_at: string };
export type Sequence = {
  id: string;
  name: string;
  status: SeqStatus;
  address_id: string | null;
  steps: Step[];
  audience: Audience;
  stop_stages: string[];
  auto_enroll: boolean;
  auto_since: string | null;
  consent_at: string | null;
  created_at: string;
  updated_at: string;
};
export type Stats = { active: number; due: number; done: number; stopped: number; reasons: Partial<Record<StopReason, number>>; steps: { step: number; sent: number; failed: number; bounced: number }[] };
export type EnrollmentRow = { id: string; email: string; name: string; status: "active" | "done" | "stopped"; stop_reason: StopReason | null; sent_count: number; next_on: string | null; enrolled_at: string };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** The brand's sequences, newest first. `ready` is false until the database step has been run. */
export async function listSequences(brandId: string): Promise<{ ready: boolean; rows: SequenceRow[] }> {
  const { data, error } = await db().from("email_sequences").select("id, name, status, steps, auto_enroll, updated_at").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(50);
  if (error) return { ready: error.code !== SEQ_MISSING, rows: [] };
  return {
    ready: true,
    rows: (data ?? []).map((r) => ({ id: r.id as string, name: r.name as string, status: r.status as SeqStatus, steps: Array.isArray(r.steps) ? r.steps.length : 0, auto_enroll: r.auto_enroll === true, updated_at: r.updated_at as string })),
  };
}

export async function getSequence(brandId: string, id: string): Promise<Sequence | null> {
  const { data } = await db()
    .from("email_sequences")
    .select("id, name, status, address_id, steps, audience, stop_stages, auto_enroll, auto_since, consent_at, created_at, updated_at")
    .eq("brand_id", brandId)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    name: data.name as string,
    status: data.status as SeqStatus,
    address_id: (data.address_id as string | null) ?? null,
    steps: parseSteps(data.steps),
    audience: parseAudience(data.audience),
    stop_stages: parseStopStages(data.stop_stages),
    auto_enroll: data.auto_enroll === true,
    auto_since: (data.auto_since as string | null) ?? null,
    consent_at: (data.consent_at as string | null) ?? null,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  };
}

/** Where everyone is, why people left, and how each email did. The database counts, so a long list costs the same as a short one. */
export async function sequenceStats(id: string, today: string): Promise<Stats> {
  const { data, error } = await db().rpc("email_sequence_stats", { p_sequence: id, p_today: today });
  const o = (error || !data || typeof data !== "object" ? {} : data) as Record<string, unknown>;
  const reasons: Stats["reasons"] = {};
  for (const r of STOP_REASONS) {
    const n = num((o.reasons as Record<string, unknown> | undefined)?.[r]);
    if (n > 0) reasons[r] = n;
  }
  const steps = (Array.isArray(o.steps) ? o.steps : []).map((s: Record<string, unknown>) => ({ step: num(s.step), sent: num(s.sent), failed: num(s.failed), bounced: num(s.bounced) }));
  return { active: num(o.active), due: num(o.due), done: num(o.done), stopped: num(o.stopped), reasons, steps };
}

/** The newest people in one state of the sequence. */
export async function listEnrollments(brandId: string, sequenceId: string, status: EnrollmentRow["status"], limit = 50): Promise<EnrollmentRow[]> {
  const { data } = await db()
    .from("email_enrollments")
    .select("id, email, vars, status, stop_reason, sent_count, next_on, enrolled_at")
    .eq("brand_id", brandId)
    .eq("sequence_id", sequenceId)
    .eq("status", status)
    .order("enrolled_at", { ascending: false })
    .order("id")
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    email: r.email as string,
    name: String((r.vars as { name?: string } | null)?.name ?? ""),
    status: r.status as EnrollmentRow["status"],
    stop_reason: (r.stop_reason as StopReason | null) ?? null,
    sent_count: num(r.sent_count),
    next_on: (r.next_on as string | null) ?? null,
    enrolled_at: r.enrolled_at as string,
  }));
}
