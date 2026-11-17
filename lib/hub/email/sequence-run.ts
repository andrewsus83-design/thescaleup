import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listAddresses, listDomains, sendable } from "../mail/data";
import { fromHeader } from "../mail/model";
import { isResendReady, sendBatch, type SendInput } from "../mail/resend";
import { hubTz, todayIn } from "../tasks/dates";
import { deliver } from "./deliver";
import { EMAIL_LIMITS, firstName, merge, renderEmail, type Vars } from "./model";
import { publicOrigin, unsubscribeKey } from "./secret";
import { afterSend, decide, parseSteps, parseStopStages, SEQ_LIMITS, type PersonNow, type Step, type StopReason, type SuppressionReason } from "./sequence-model";
import { signUnsubscribe } from "./token";

// Sends the emails of every active sequence that are due, and adds the people who joined the CRM since automatic adding was switched on.
// It runs once a morning (see app/api/cron/daily) and when someone presses "Send what is due now".
//
// An email is never sent twice. Before anything is sent, each person is moved to their next step in one conditional update ("only if
// they are still at step k"), and only the people that update returned are emailed. Two runs at once therefore split the work instead of
// doubling it. If the process dies between the update and the send, that person misses one email; nobody gets one twice.

export type RunResult = { sequences: number; enrolled: number; sent: number; stopped: number; failed: number; retry: boolean; blocked: string };
const fresh = (): RunResult => ({ sequences: 0, enrolled: 0, sent: 0, stopped: 0, failed: 0, retry: false, blocked: "" });

type Sender = { display_name: string | null; email: string };

/** One email of a sequence, ready for Resend. The same code builds the test email, so a test shows exactly what people get. */
export function stepEmail(step: Step, vars: Vars, from: Sender, unsubscribeUrl: string, oneClickUrl: string): SendInput {
  const out = renderEmail(step.doc, vars, unsubscribeUrl);
  return {
    from: fromHeader(from.display_name, from.email),
    to: [],
    subject: merge(step.doc.subject, vars).replace(/[\r\n]+/g, " ").trim().slice(0, EMAIL_LIMITS.subject) || "(no subject)",
    text: out.text,
    html: out.html,
    headers: { "List-Unsubscribe": `<${oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

type Due = { id: string; person_id: string | null; email: string; vars: { name?: string; company?: string } | null; sent_count: number; enrolled_at: string };

export async function runSequences(opts: { brandId?: string; sequenceId?: string; budgetMs?: number } = {}): Promise<RunResult> {
  const result = fresh();
  if (!isResendReady()) return { ...result, blocked: "Mail is not connected: RESEND_API_KEY is not set on the server." };
  const key = unsubscribeKey();
  if (!key) return { ...result, blocked: "The workspace key that signs unsubscribe links (SECRETS_KEY_1) is not set on the server." };
  const admin = createSupabaseAdminClient();
  const today = todayIn(hubTz());
  const deadline = Date.now() + (opts.budgetMs ?? 35_000);
  const origin = publicOrigin();

  let q = admin.from("email_sequences").select("id, brand_id, name, address_id, steps, audience, stop_stages, auto_enroll, auto_since").eq("status", "active").order("created_at").limit(200);
  if (opts.brandId) q = q.eq("brand_id", opts.brandId);
  if (opts.sequenceId) q = q.eq("id", opts.sequenceId);
  const { data: sequences, error } = await q;
  if (error) {
    if (error.code !== "42P01") console.error("[sequences] could not read sequences:", error.message);
    return result;
  }

  const brands = new Map<string, { name: string; senders: (Sender & { id: string })[] } | null>();
  const brandOf = async (brandId: string) => {
    if (brands.has(brandId)) return brands.get(brandId) ?? null;
    const { data: b } = await admin.from("brands").select("name, status").eq("id", brandId).maybeSingle();
    let got: { name: string; senders: (Sender & { id: string })[] } | null = null;
    if (b && b.status !== "archived") {
      const domains = await listDomains(brandId);
      got = { name: String(b.name ?? ""), senders: sendable(await listAddresses(brandId, domains), domains).map((a) => ({ id: a.id, display_name: a.display_name ?? null, email: a.email })) };
    }
    brands.set(brandId, got);
    return got;
  };

  for (const seq of sequences ?? []) {
    if (Date.now() > deadline) break;
    try {
      const steps = parseSteps(seq.steps);
      const brand = await brandOf(String(seq.brand_id));
      const from = brand?.senders.find((a) => a.id === seq.address_id);
      if (!brand || steps.length === 0 || !from) {
        // Nothing is lost: people keep their place and are emailed once the sender is fixed.
        if (brand && steps.length > 0) result.blocked = "A sequence has no verified address to send from. Fix it in Settings, Mailbox.";
        continue;
      }
      result.sequences++;
      if (seq.auto_enroll && seq.auto_since) {
        const { data } = await admin.rpc("email_sequence_enroll", { p_sequence: seq.id, p_today: today, p_since: seq.auto_since, p_limit: SEQ_LIMITS.enroll, p_dry: false, p_by: null });
        const row = (Array.isArray(data) ? data[0] : data) as { added?: number } | null;
        result.enrolled += row?.added ?? 0;
      }
      const stopStages = parseStopStages(seq.stop_stages);
      const r = await sendDue({ admin, today, deadline, origin, key, seq: { id: String(seq.id), brand_id: String(seq.brand_id) }, steps, stopStages, from, brandName: brand.name, result });
      if (r === "retry") {
        result.retry = true;
        break;
      }
    } catch (e) {
      console.error("[sequences] sequence failed:", String(seq.id), e instanceof Error ? e.message : e);
    }
  }
  return result;
}

async function sendDue(c: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  today: string;
  deadline: number;
  origin: string;
  key: Buffer;
  seq: { id: string; brand_id: string };
  steps: Step[];
  stopStages: string[];
  from: Sender;
  brandName: string;
  result: RunResult;
}): Promise<"ok" | "retry"> {
  const { admin, today, seq, steps, result } = c;
  for (let round = 0; round < 200; round++) {
    if (Date.now() > c.deadline) return "ok";
    const { data } = await admin
      .from("email_enrollments")
      .select("id, person_id, email, vars, sent_count, enrolled_at")
      .eq("sequence_id", seq.id)
      .eq("status", "active")
      .lte("next_on", today)
      .order("next_on")
      .order("id")
      .limit(SEQ_LIMITS.batch);
    const due = (data ?? []) as Due[];
    if (due.length === 0) return "ok";

    // What is true now about each person: unsubscribed or bounced, wrote back, still in the CRM with the same address and stage.
    const emails = due.map((d) => d.email);
    const since = due.reduce((min, d) => (d.enrolled_at < min ? d.enrolled_at : min), due[0].enrolled_at);
    const personIds = [...new Set(due.map((d) => d.person_id).filter((x): x is string => !!x))];
    const [sup, inbound, people] = await Promise.all([
      admin.from("email_suppressions").select("email, reason").eq("brand_id", seq.brand_id).in("email", emails),
      admin.from("mail_messages").select("from_email, created_at").eq("brand_id", seq.brand_id).eq("direction", "in").in("from_email", emails).gte("created_at", since).limit(1000),
      personIds.length ? admin.from("crm_people").select("id, email, stage").eq("brand_id", seq.brand_id).in("id", personIds) : Promise.resolve({ data: [] as { id: string; email: string; stage: string }[] }),
    ]);
    const suppressed = new Map<string, SuppressionReason>((sup.data ?? []).map((s) => [String(s.email), s.reason as SuppressionReason]));
    const repliedAt = new Map<string, string>();
    for (const m of inbound.data ?? []) {
      const e = String(m.from_email).toLowerCase();
      const at = String(m.created_at);
      if (!repliedAt.has(e) || at > (repliedAt.get(e) as string)) repliedAt.set(e, at);
    }
    const person = new Map<string, PersonNow>((people.data ?? []).map((p) => [String(p.id), { email: String(p.email ?? ""), stage: String(p.stage ?? "") }]));

    let moved = 0; // people this round settled one way or the other; a round that settles nobody stops the loop instead of repeating itself
    const stops = new Map<StopReason, string[]>();
    const sends = new Map<number, Due[]>();
    for (const d of due) {
      const v = decide(d, { stepCount: steps.length, suppressed, repliedAt, person: d.person_id ? (person.get(d.person_id) ?? null) : null, stopStages: c.stopStages });
      if (v.act === "stop") stops.set(v.reason, [...(stops.get(v.reason) ?? []), d.id]);
      else sends.set(d.sent_count, [...(sends.get(d.sent_count) ?? []), d]);
    }
    for (const [reason, ids] of stops) {
      const { data: left } = await admin
        .from("email_enrollments")
        .update({ status: reason === "completed" ? "done" : "stopped", stop_reason: reason, next_on: null })
        .in("id", ids)
        .eq("status", "active")
        .select("id");
      result.stopped += left?.length ?? 0;
      moved += left?.length ?? 0;
    }

    for (const [k, group] of sends) {
      const after = afterSend(today, steps, k + 1);
      const { data: claimedRows } = await admin
        .from("email_enrollments")
        .update({ sent_count: k + 1, status: after.status, next_on: after.next_on, stop_reason: after.status === "done" ? "completed" : null, last_sent_at: new Date().toISOString() })
        .in("id", group.map((d) => d.id))
        .eq("sent_count", k)
        .eq("status", "active")
        .select("id");
      const claimed = new Set((claimedRows ?? []).map((r) => String(r.id)));
      const mine = group.filter((d) => claimed.has(d.id));
      moved += mine.length;
      if (mine.length === 0) continue;

      const emails = mine.map((d) => {
        const v = d.vars ?? {};
        const vars: Vars = { first_name: firstName(v.name ?? ""), name: v.name, company: v.company, brand: c.brandName };
        const token = encodeURIComponent(signUnsubscribe(c.key, seq.brand_id, d.email));
        const mail = stepEmail(steps[k], vars, c.from, `${c.origin}/unsubscribe/${token}`, `${c.origin}/api/unsubscribe/${token}`);
        return { ...mail, to: [d.email] };
      });
      const out = await deliver(sendBatch, `${seq.id}:${k}`, emails, mine.map((d) => d.id));
      if (out === "retry") {
        // Resend is busy or down. Put these people back exactly where they were; the next run tries again with the same key.
        await admin
          .from("email_enrollments")
          .update({ sent_count: k, status: "active", next_on: today, stop_reason: null })
          .in("id", mine.map((d) => d.id))
          .eq("sent_count", k + 1);
        return "retry";
      }
      const rows = mine.map((d, i) => ({
        enrollment_id: d.id,
        sequence_id: seq.id,
        brand_id: seq.brand_id,
        step: k,
        email: d.email,
        status: out[i].id ? "sent" : "failed",
        resend_id: out[i].id ?? null,
        error: out[i].id ? null : (out[i].error ?? "Resend did not confirm this email.").slice(0, 300),
      }));
      const { error } = await admin.from("email_step_sends").upsert(rows, { onConflict: "enrollment_id,step", ignoreDuplicates: true });
      if (error) console.error("[sequences] could not log the sends:", error.message);
      const failed = mine.filter((_, i) => !out[i].id).map((d) => d.id);
      result.sent += mine.length - failed.length;
      result.failed += failed.length;
      // An address Resend refuses will not work for the next email either.
      if (failed.length) await admin.from("email_enrollments").update({ status: "stopped", stop_reason: "failed", next_on: null }).in("id", failed);
    }
    if (moved === 0) return "ok";
  }
  return "ok";
}
