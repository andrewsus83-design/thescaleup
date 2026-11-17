"use server";

import { revalidatePath } from "next/cache";
import { isResendReady, sendEmail } from "./mail/resend";
import { listAddresses, listDomains, sendable } from "./mail/data";
import { EMAIL_LIMITS, firstName, parseAudience, type Vars } from "./email/model";
import { publicOrigin, unsubscribeKey } from "./email/secret";
import { getSequence, SEQ_MISSING } from "./email/sequence-data";
import { cleanName, parseSteps, parseStopStages, SEQ_LIMITS, sequenceProblems } from "./email/sequence-model";
import { runSequences, stepEmail } from "./email/sequence-run";
import { signUnsubscribe } from "./email/token";
import { atLeast } from "./permissions";
import { allow } from "./ratelimit";
import { audit } from "./session";
import { hubTz, todayIn } from "./tasks/dates";
import { UUID, taskContext, type Ctx } from "./tasks/context";

// Sequences: write the emails, pick who joins, start it. Mail access is needed for all of it, and adding people needs the person to confirm
// that everyone agreed to get the brand's email. Nobody who unsubscribed or bounced is ever added, and anyone who does later leaves.

type Done<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const refresh = (slug: string) => revalidatePath(`/hub/b/${slug}/mail`, "layout");
const NOT_READY = "Sequences need their database step first (20261117400000_email_sequences.sql). Ask the person who runs the database updates.";
const SENDER = "Pick an address to send from. Its domain must be verified in Settings, Mailbox.";

async function access(brandId: unknown): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const c = await taskContext(brandId, "mail");
  if (!c.ok) return c;
  if (!atLeast(c.ctx.level, "edit")) return fail("You can read mail here but not change it.");
  return c;
}

async function senderFor(brandId: string, addressId: string | null) {
  if (!addressId) return null;
  const domains = await listDomains(brandId);
  return sendable(await listAddresses(brandId, domains), domains).find((a) => a.id === addressId) ?? null;
}

export async function saveSequence(input: { brandId: string; id?: string; name: string; addressId: string; steps: unknown; audience: unknown; stopStages: unknown }): Promise<Done<{ id: string; autoOff: boolean }>> {
  const c = await access(input.brandId);
  if (!c.ok) return c;
  const { ctx } = c;
  const name = cleanName(input.name);
  if (!name) return fail("Give the sequence a name. Only your team sees it.");
  const steps = parseSteps(input.steps);
  const audience = parseAudience(input.audience);
  const stop_stages = parseStopStages(input.stopStages);
  let address_id: string | null = null;
  if (input.addressId) {
    if (!UUID.test(input.addressId)) return fail("Pick an address to send from.");
    const domains = await listDomains(ctx.brandId);
    if (!(await listAddresses(ctx.brandId, domains)).some((a) => a.id === input.addressId)) return fail("Pick an address to send from.");
    address_id = input.addressId;
  }
  const row = { name, address_id, steps, audience, stop_stages };
  if (input.id) {
    if (!UUID.test(input.id)) return fail("Unknown sequence.");
    const { data: before, error: readErr } = await ctx.admin.from("email_sequences").select("audience, auto_enroll").eq("brand_id", ctx.brandId).eq("id", input.id).maybeSingle();
    if (readErr) return fail(readErr.code === SEQ_MISSING ? NOT_READY : "Could not save. Try again.");
    if (!before) return fail("Unknown sequence.");
    // Whoever switched automatic adding on agreed for this audience. A different audience needs a new yes.
    const autoOff = before.auto_enroll === true && JSON.stringify(parseAudience(before.audience)) !== JSON.stringify(audience);
    const { data, error } = await ctx.admin
      .from("email_sequences")
      .update({ ...row, ...(autoOff ? { auto_enroll: false, auto_since: null } : {}) })
      .eq("brand_id", ctx.brandId)
      .eq("id", input.id)
      .select("id");
    if (error || !data?.length) return fail("Could not save. Try again.");
    refresh(ctx.slug);
    return { ok: true, id: input.id, autoOff };
  }
  const { data, error } = await ctx.admin.from("email_sequences").insert({ ...row, brand_id: ctx.brandId, created_by: ctx.user.id }).select("id").single();
  if (error || !data) return fail(error?.code === SEQ_MISSING ? NOT_READY : "Could not save. Try again.");
  refresh(ctx.slug);
  return { ok: true, id: data.id as string, autoOff: false };
}

export async function deleteSequence(brandId: string, id: string): Promise<Done> {
  const c = await access(brandId);
  if (!c.ok) return c;
  if (!UUID.test(id)) return fail("Unknown sequence.");
  const { data } = await c.ctx.admin.from("email_sequences").delete().eq("brand_id", c.ctx.brandId).eq("id", id).select("id");
  if (!data?.length) return fail("Unknown sequence.");
  await audit({ actor: c.ctx.user, brandId: c.ctx.brandId, action: "email.sequence.delete", target: id });
  refresh(c.ctx.slug);
  return { ok: true };
}

/** Start, pause or resume. Starting needs everything that sending needs, so a sequence never starts and then silently does nothing. */
export async function setSequenceStatus(brandId: string, id: string, to: "active" | "paused"): Promise<Done> {
  const c = await access(brandId);
  if (!c.ok) return c;
  const { ctx } = c;
  if (!UUID.test(id)) return fail("Unknown sequence.");
  const seq = await getSequence(ctx.brandId, id);
  if (!seq) return fail("Unknown sequence.");
  if (to === "active") {
    if (seq.status === "active") return { ok: true };
    if (!isResendReady()) return fail("Mail is not connected yet: RESEND_API_KEY is not set on the server.");
    if (!unsubscribeKey()) return fail("Sequences need the workspace encryption key (SECRETS_KEY_1) to sign unsubscribe links.");
    const problems = sequenceProblems(seq.steps);
    if (problems.length) return fail(problems[0]);
    if (!(await senderFor(ctx.brandId, seq.address_id))) return fail(SENDER);
  } else if (seq.status !== "active") {
    return fail("Only a running sequence can be paused.");
  }
  const { data } = await ctx.admin.from("email_sequences").update({ status: to }).eq("brand_id", ctx.brandId).eq("id", id).eq("status", seq.status).select("id");
  if (!data?.length) return fail("Someone else just changed this sequence. Reload the page.");
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: to === "paused" ? "email.sequence.pause" : seq.status === "paused" ? "email.sequence.resume" : "email.sequence.start", target: id });
  refresh(ctx.slug);
  return { ok: true };
}

const today = () => todayIn(hubTz());

/** How many people could join right now. Nothing changes. */
export async function countEnrollable(brandId: string, id: string): Promise<Done<{ count: number }>> {
  const c = await access(brandId);
  if (!c.ok) return c;
  if (!UUID.test(id)) return fail("Unknown sequence.");
  if (!(await getSequence(c.ctx.brandId, id))) return fail("Unknown sequence.");
  const { data, error } = await c.ctx.admin.rpc("email_sequence_enroll", { p_sequence: id, p_today: today(), p_since: null, p_limit: 0, p_dry: true, p_by: null });
  if (error) return fail(error.code === SEQ_MISSING || error.code === "PGRST202" ? NOT_READY : "Could not read your contacts. Try again.");
  const row = (Array.isArray(data) ? data[0] : data) as { matching?: number } | null;
  return { ok: true, count: row?.matching ?? 0 };
}

/** Adds the people who match, up to a thousand at a time. Anyone who is already in it, unsubscribed or bounced is left out. */
export async function enrollPeople(brandId: string, id: string, consent: boolean): Promise<Done<{ added: number; matching: number }>> {
  const c = await access(brandId);
  if (!c.ok) return c;
  const { ctx } = c;
  if (!UUID.test(id)) return fail("Unknown sequence.");
  if (consent !== true) return fail("Confirm that everyone on the list agreed to get email from this brand.");
  if (!allow(`email-seq-enroll:${ctx.user.id}`, 30)) return fail("That is a lot of additions in an hour. Try again later.");
  const seq = await getSequence(ctx.brandId, id);
  if (!seq) return fail("Unknown sequence.");
  if (seq.status !== "active") return fail("Start the sequence first, then add people.");
  const { data, error } = await ctx.admin.rpc("email_sequence_enroll", { p_sequence: id, p_today: today(), p_since: null, p_limit: SEQ_LIMITS.enroll, p_dry: false, p_by: ctx.user.id });
  if (error) return fail("Could not add people. Nothing was sent. Try again.");
  const row = (Array.isArray(data) ? data[0] : data) as { matching?: number; added?: number } | null;
  const added = row?.added ?? 0;
  await ctx.admin.from("email_sequences").update({ consent_by: ctx.user.id, consent_at: new Date().toISOString() }).eq("id", id);
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "email.sequence.enroll", target: id, meta: { added } });
  refresh(ctx.slug);
  return { ok: true, added, matching: row?.matching ?? added };
}

/** Automatic adding: people who join the CRM from now on and match the audience are added once a day. Switching it on needs the same yes. */
export async function setAutoEnroll(brandId: string, id: string, on: boolean, consent: boolean): Promise<Done> {
  const c = await access(brandId);
  if (!c.ok) return c;
  const { ctx } = c;
  if (!UUID.test(id)) return fail("Unknown sequence.");
  const seq = await getSequence(ctx.brandId, id);
  if (!seq) return fail("Unknown sequence.");
  if (on) {
    if (consent !== true) return fail("Confirm that everyone who joins this way agreed to get email from this brand.");
    if (seq.audience.kinds.length === 0) return fail("Pick who joins first (leads, clients, or both).");
  }
  const patch = on ? { auto_enroll: true, auto_since: new Date().toISOString(), consent_by: ctx.user.id, consent_at: new Date().toISOString() } : { auto_enroll: false, auto_since: null };
  const { data } = await ctx.admin.from("email_sequences").update(patch).eq("brand_id", ctx.brandId).eq("id", id).select("id");
  if (!data?.length) return fail("Unknown sequence.");
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: on ? "email.sequence.auto_on" : "email.sequence.auto_off", target: id });
  refresh(ctx.slug);
  return { ok: true };
}

/** Sends what is due today without waiting for the morning run. */
export async function sendDueNow(brandId: string, id: string): Promise<Done<{ sent: number; stopped: number; failed: number; enrolled: number; retry: boolean }>> {
  const c = await access(brandId);
  if (!c.ok) return c;
  const { ctx } = c;
  if (!UUID.test(id)) return fail("Unknown sequence.");
  if (!allow(`email-seq-run:${ctx.user.id}`, 30)) return fail("That is a lot of runs in an hour. Try again later.");
  const seq = await getSequence(ctx.brandId, id);
  if (!seq) return fail("Unknown sequence.");
  if (seq.status !== "active") return fail("Only a running sequence sends emails.");
  const r = await runSequences({ brandId: ctx.brandId, sequenceId: id, budgetMs: 40_000 });
  if (r.blocked && r.sequences === 0) return fail(r.blocked);
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "email.sequence.run", target: id, meta: { sent: r.sent, stopped: r.stopped, failed: r.failed } });
  refresh(ctx.slug);
  return { ok: true, sent: r.sent, stopped: r.stopped, failed: r.failed, enrolled: r.enrolled, retry: r.retry };
}

/** Takes one person out. They are not emailed again, and are not added again by automatic adding. */
export async function stopPerson(brandId: string, enrollmentId: string): Promise<Done> {
  const c = await access(brandId);
  if (!c.ok) return c;
  if (!UUID.test(enrollmentId)) return fail("Unknown person.");
  const { data } = await c.ctx.admin.from("email_enrollments").update({ status: "stopped", stop_reason: "manual", next_on: null }).eq("brand_id", c.ctx.brandId).eq("id", enrollmentId).eq("status", "active").select("id, sequence_id");
  if (!data?.length) return fail("They are not in the sequence any more.");
  await audit({ actor: c.ctx.user, brandId: c.ctx.brandId, action: "email.sequence.stop_person", target: String(data[0].sequence_id) });
  refresh(c.ctx.slug);
  return { ok: true };
}

/** One email of the sequence to the person who is signed in, so they see what a customer will see. */
export async function sendSequenceTest(brandId: string, id: string, stepIndex: number): Promise<Done<{ to: string }>> {
  const c = await access(brandId);
  if (!c.ok) return c;
  const { ctx } = c;
  if (!isResendReady()) return fail("Mail is not connected yet: RESEND_API_KEY is not set on the server.");
  const key = unsubscribeKey();
  if (!key) return fail("Sequences need the workspace encryption key (SECRETS_KEY_1) to sign unsubscribe links.");
  if (!allow(`email-test:${ctx.user.id}`, 20)) return fail("That is a lot of test emails. Try again in a while.");
  if (!UUID.test(id)) return fail("Save the sequence first.");
  const seq = await getSequence(ctx.brandId, id);
  if (!seq) return fail("Save the sequence first.");
  const step = Number.isInteger(stepIndex) ? seq.steps[stepIndex] : undefined;
  if (!step) return fail("Save the sequence first, then send the test.");
  const from = await senderFor(ctx.brandId, seq.address_id);
  if (!from) return fail(SENDER);
  const { data: brand } = await ctx.admin.from("brands").select("name").eq("id", ctx.brandId).maybeSingle();
  const local = ctx.user.email.split("@")[0];
  const vars: Vars = { first_name: firstName(local), name: local, company: "Example Co", brand: String(brand?.name ?? "") };
  const origin = publicOrigin();
  const token = encodeURIComponent(signUnsubscribe(key, ctx.brandId, ctx.user.email));
  const mail = stepEmail(step, vars, from, `${origin}/unsubscribe/${token}`, `${origin}/api/unsubscribe/${token}`);
  const sent = await sendEmail(
    { ...mail, to: [ctx.user.email], subject: `[Test ${stepIndex + 1}] ${mail.subject}`.slice(0, EMAIL_LIMITS.subject + 12) },
    `seq-test:${id}:${stepIndex}:${ctx.user.id}:${Math.floor(Date.now() / 60_000)}`,
  );
  if (!sent.ok) return fail(`The test was not sent. Resend said: ${sent.error}`);
  return { ok: true, to: ctx.user.email };
}
