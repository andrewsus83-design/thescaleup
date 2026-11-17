"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCampaign, getTemplate, resolveAudience } from "./email/data";
import { docProblems, EMAIL_LIMITS, parseAudience, parseDoc, renderEmail, firstName, type Audience } from "./email/model";
import { signUnsubscribe } from "./email/token";
import { publicOrigin, unsubscribeKey } from "./email/secret";
import { listAddresses, listDomains, sendable } from "./mail/data";
import { fromHeader } from "./mail/model";
import { isResendReady, sendEmail } from "./mail/resend";
import { atLeast } from "./permissions";
import { allow } from "./ratelimit";
import { audit } from "./session";
import { UUID, taskContext, type Ctx } from "./tasks/context";

// Campaigns: write one, test it, pick who gets it, send it. Mail access is needed for all of it, and sending needs the person to confirm
// that everyone on the list agreed to get the brand's email. Nobody who unsubscribed or bounced is ever included.

type Done<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const refresh = (slug: string) => revalidatePath(`/hub/b/${slug}/mail`, "layout");
const nameOf = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, EMAIL_LIMITS.name) : "");

async function access(brandId: unknown): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const c = await taskContext(brandId, "mail");
  if (!c.ok) return c;
  if (!atLeast(c.ctx.level, "edit")) return fail("You can read mail here but not change it.");
  return c;
}

/** The address a campaign is sent from: it must be this brand's and its domain verified. */
async function senderFor(brandId: string, addressId: string | null) {
  if (!addressId) return null;
  const domains = await listDomains(brandId);
  const from = sendable(await listAddresses(brandId, domains), domains).find((a) => a.id === addressId);
  return from ?? null;
}

export async function saveCampaign(input: { brandId: string; id?: string; name: string; doc: unknown; addressId: string; audience: unknown }): Promise<Done<{ id: string }>> {
  const c = await access(input.brandId);
  if (!c.ok) return c;
  const { ctx } = c;
  const name = nameOf(input.name);
  if (!name) return fail("Give the campaign a name. Only your team sees it.");
  const doc = parseDoc(input.doc);
  const audience = parseAudience(input.audience);
  let addressId: string | null = null;
  if (input.addressId) {
    if (!UUID.test(input.addressId)) return fail("Pick an address to send from.");
    const domains = await listDomains(ctx.brandId);
    if (!(await listAddresses(ctx.brandId, domains)).some((a) => a.id === input.addressId)) return fail("Pick an address to send from.");
    addressId = input.addressId;
  }
  const row = { brand_id: ctx.brandId, name, doc, address_id: addressId, audience };
  if (input.id) {
    if (!UUID.test(input.id)) return fail("Unknown campaign.");
    const { data, error } = await ctx.admin.from("email_campaigns").update(row).eq("brand_id", ctx.brandId).eq("id", input.id).eq("status", "draft").select("id");
    if (error) return fail(error.code === "42P01" ? NOT_READY : "Could not save. Try again.");
    if (!data?.length) return fail("This campaign was already sent, so it cannot be changed. Duplicate it to send a new one.");
    refresh(ctx.slug);
    return { ok: true, id: input.id };
  }
  const { data, error } = await ctx.admin.from("email_campaigns").insert({ ...row, created_by: ctx.user.id }).select("id").single();
  if (error || !data) return fail(error?.code === "42P01" ? NOT_READY : "Could not save. Try again.");
  refresh(ctx.slug);
  return { ok: true, id: data.id as string };
}
const NOT_READY = "Campaigns need their database step first (20261117320000_email_builder.sql). Ask the person who runs the database updates.";

export async function saveAsTemplate(input: { brandId: string; name: string; doc: unknown }): Promise<Done<{ id: string }>> {
  const c = await access(input.brandId);
  if (!c.ok) return c;
  const name = nameOf(input.name);
  if (!name) return fail("Give the template a name.");
  const { data, error } = await c.ctx.admin.from("email_templates").insert({ brand_id: c.ctx.brandId, name, doc: parseDoc(input.doc), created_by: c.ctx.user.id }).select("id").single();
  if (error || !data) return fail(error?.code === "42P01" ? NOT_READY : "Could not save the template. Try again.");
  refresh(c.ctx.slug);
  return { ok: true, id: data.id as string };
}

export async function deleteTemplate(brandId: string, id: string): Promise<Done> {
  const c = await access(brandId);
  if (!c.ok) return c;
  if (!UUID.test(id)) return fail("Unknown template.");
  await c.ctx.admin.from("email_templates").delete().eq("brand_id", c.ctx.brandId).eq("id", id);
  refresh(c.ctx.slug);
  return { ok: true };
}

export async function deleteCampaign(brandId: string, id: string): Promise<Done> {
  const c = await access(brandId);
  if (!c.ok) return c;
  if (!UUID.test(id)) return fail("Unknown campaign.");
  const { data } = await c.ctx.admin.from("email_campaigns").delete().eq("brand_id", c.ctx.brandId).eq("id", id).neq("status", "sending").select("id");
  if (!data?.length) return fail("A campaign that is sending cannot be deleted. Let it finish first.");
  refresh(c.ctx.slug);
  return { ok: true };
}

/** A draft copy of any campaign, so what worked once is easy to send again. */
export async function duplicateCampaign(brandId: string, id: string): Promise<Done<{ id: string }>> {
  const c = await access(brandId);
  if (!c.ok) return c;
  if (!UUID.test(id)) return fail("Unknown campaign.");
  const src = await getCampaign(c.ctx.brandId, id);
  if (!src) return fail("Unknown campaign.");
  const { data, error } = await c.ctx.admin
    .from("email_campaigns")
    .insert({ brand_id: c.ctx.brandId, name: `${src.name} (copy)`.slice(0, EMAIL_LIMITS.name), doc: src.doc, address_id: src.address_id, audience: src.audience, created_by: c.ctx.user.id })
    .select("id")
    .single();
  if (error || !data) return fail("Could not copy it. Try again.");
  refresh(c.ctx.slug);
  return { ok: true, id: data.id as string };
}

export async function loadTemplateDoc(brandId: string, id: string) {
  const c = await access(brandId);
  if (!c.ok) return c;
  if (!UUID.test(id)) return fail("Unknown template.");
  const t = await getTemplate(c.ctx.brandId, id);
  return t ? { ok: true as const, name: t.name, doc: t.doc } : fail("Unknown template.");
}

/** How many people the audience reaches today, and why others are left out. Nothing is sent. */
export async function previewAudience(brandId: string, rawAudience: unknown): Promise<Done<{ count: number; matched: number; skips: { noEmail: number; invalid: number; duplicate: number; suppressed: number; overLimit: number } }>> {
  const c = await access(brandId);
  if (!c.ok) return c;
  const audience: Audience = parseAudience(rawAudience);
  const { list, skips, matched } = await resolveAudience(c.ctx.brandId, audience);
  return { ok: true, count: list.length, matched, skips };
}

/** One email to the person who is signed in, so they see what a customer will see. */
export async function sendTest(brandId: string, id: string): Promise<Done<{ to: string }>> {
  const c = await access(brandId);
  if (!c.ok) return c;
  const { ctx } = c;
  if (!isResendReady()) return fail("Mail is not connected yet: RESEND_API_KEY is not set on the server.");
  const key = unsubscribeKey();
  if (!key) return fail("Campaigns need the workspace encryption key (SECRETS_KEY_1) to sign unsubscribe links.");
  if (!allow(`email-test:${ctx.user.id}`, 20)) return fail("That is a lot of test emails. Try again in a while.");
  if (!UUID.test(id)) return fail("Save the campaign first.");
  const camp = await getCampaign(ctx.brandId, id);
  if (!camp) return fail("Save the campaign first.");
  const from = await senderFor(ctx.brandId, camp.address_id);
  if (!from) return fail("Pick an address to send from. Its domain must be verified in Settings, Mailbox.");
  const { data: brand } = await ctx.admin.from("brands").select("name").eq("id", ctx.brandId).maybeSingle();
  const vars = { first_name: firstName(ctx.user.email.split("@")[0]), name: ctx.user.email.split("@")[0], company: "Example Co", brand: String(brand?.name ?? "") };
  const unsub = `${publicOrigin()}/unsubscribe/${encodeURIComponent(signUnsubscribe(key, ctx.brandId, ctx.user.email))}`;
  const out = renderEmail(camp.doc, vars, unsub);
  const subject = `[Test] ${camp.doc.subject || "No subject yet"}`.slice(0, EMAIL_LIMITS.subject + 8);
  const sent = await sendEmail({ from: fromHeader(from.display_name, from.email), to: [ctx.user.email], subject, text: out.text, html: out.html }, createHash("sha256").update(`${id}:${ctx.user.id}:${Math.floor(Date.now() / 60_000)}`).digest("hex"));
  if (!sent.ok) return fail(`The test was not sent. Resend said: ${sent.error}`);
  return { ok: true, to: ctx.user.email };
}

/** Locks the audience in and queues one email per person. The sending itself happens in small batches (see the send route). */
export async function startCampaign(brandId: string, id: string, consent: boolean): Promise<Done<{ total: number }>> {
  const c = await access(brandId);
  if (!c.ok) return c;
  const { ctx } = c;
  if (!isResendReady()) return fail("Mail is not connected yet: RESEND_API_KEY is not set on the server.");
  if (!unsubscribeKey()) return fail("Campaigns need the workspace encryption key (SECRETS_KEY_1) to sign unsubscribe links.");
  if (!UUID.test(id)) return fail("Save the campaign first.");
  if (consent !== true) return fail("Confirm that everyone on the list agreed to get email from this brand.");
  if (!allow(`email-start:${ctx.user.id}`, 10)) return fail("That is a lot of campaigns in an hour. Try again later.");
  const camp = await getCampaign(ctx.brandId, id);
  if (!camp) return fail("Unknown campaign.");
  if (camp.status !== "draft") return fail("This campaign was already started.");
  const problems = docProblems(camp.doc);
  if (problems.length) return fail(problems[0]);
  if (!(await senderFor(ctx.brandId, camp.address_id))) return fail("Pick an address to send from. Its domain must be verified in Settings, Mailbox.");
  const { list } = await resolveAudience(ctx.brandId, camp.audience, EMAIL_LIMITS.recipients);
  if (list.length === 0) return fail("Nobody to send to. Pick who gets it and check that they have an email address.");

  // Whoever presses first wins: the draft becomes "sending" once.
  const { data: claimed } = await ctx.admin
    .from("email_campaigns")
    .update({ status: "sending", total: list.length, sent: 0, failed: 0, consent_by: ctx.user.id, consent_at: new Date().toISOString() })
    .eq("brand_id", ctx.brandId)
    .eq("id", id)
    .eq("status", "draft")
    .select("id");
  if (!claimed?.length) return fail("This campaign was already started.");
  for (let i = 0; i < list.length; i += 500) {
    const rows = list.slice(i, i + 500).map((r) => ({ campaign_id: id, brand_id: ctx.brandId, person_id: r.person_id, email: r.email, vars: r.vars }));
    const { error } = await ctx.admin.from("email_sends").insert(rows);
    if (error) {
      console.error("[email] could not queue the recipients:", error.message);
      await ctx.admin.from("email_sends").delete().eq("campaign_id", id);
      await ctx.admin.from("email_campaigns").update({ status: "draft", total: 0, consent_by: null, consent_at: null }).eq("id", id);
      return fail("Could not queue the emails. Nothing was sent. Try again.");
    }
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "email.campaign.start", target: id, meta: { recipients: list.length } });
  refresh(ctx.slug);
  return { ok: true, total: list.length };
}
