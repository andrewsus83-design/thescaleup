"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "./actions";
import { getThread, listAddresses, listDomains } from "./mail/data";
import { MAIL_LIMITS, domainError, fromHeader, localPartError, messageIds, parseRecipients, replySubject, snippet, textToHtml } from "./mail/model";
import { createDomain, deleteDomain, enableReceiving, findDomain, getDomain, isResendReady, sendEmail, verifyDomain, type ResendDomain } from "./mail/resend";
import { atLeast } from "./permissions";
import { allow } from "./ratelimit";
import { canManageTeam } from "./rules";
import { audit } from "./session";
import { UUID, str, taskContext, type Ctx } from "./tasks/context";

const refresh = (slug: string) => revalidatePath(`/hub/b/${slug}`, "layout");

/** Who is asking, what they are in this brand, and what the access matrix gives them on Mail. */
async function mailContext(fd: FormData, need: "view" | "edit" | "manage"): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const c = await taskContext(str(fd, "brandId"), "mail");
  if (!c.ok) return c;
  if (need === "manage" ? !canManageTeam(c.ctx.actor) : !atLeast(c.ctx.level, need)) {
    return { ok: false, error: need === "manage" ? "Only the founder or the agency can change the mailbox." : "You can read mail here but not change it." };
  }
  return c;
}

const DOMAIN_STATUS = new Set(["not_started", "pending", "verified", "failed", "temporary_failure"]);
const asStatus = (s: string | undefined) => (s && DOMAIN_STATUS.has(s) ? s : "not_started");

// ---------------------------------------------------------------------------------------------- domains
export async function addDomain(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await mailContext(fd, "manage");
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  if (!isResendReady()) return { error: "Mail is not connected yet: RESEND_API_KEY is not set on the server." };
  const name = str(fd, "domain").trim().toLowerCase().replace(/\.$/, "");
  const bad = domainError(name);
  if (bad) return { error: bad };
  if (!allow(`mail-domain:${ctx.user.id}`, 10)) return { error: "Too many domains added in the last hour. Try again later." };

  const { data: existing } = await ctx.admin.from("mail_domains").select("id").eq("name", name).maybeSingle();
  if (existing) return { error: "That domain is already in use." };

  const wantReceiving = fd.get("receiving") === "on";

  // A domain that is already in the agency's Resend account (other projects send from it) is linked, not created again.
  // If the lookup itself fails, fall through to creating it: Resend then answers with the real reason.
  const found = await findDomain(name);
  if (!found.ok) console.warn("[mail] domain lookup failed, creating instead:", found.error);
  const linked = found.ok && found.data !== null;

  let domain: ResendDomain;
  if (found.ok && found.data) {
    let got = await getDomain(found.data.id);
    if (!got.ok) return { error: `Resend said: ${got.error}` };
    if (wantReceiving && got.data.capabilities?.receiving !== "enabled") {
      const on = await enableReceiving(found.data.id);
      if (!on.ok) return { error: `Resend said: ${on.error}` };
      got = await getDomain(found.data.id); // the receiving record only exists after receiving is on
      if (!got.ok) return { error: `Resend said: ${got.error}` };
    }
    domain = got.data;
  } else {
    const made = await createDomain(name, wantReceiving);
    if (!made.ok) return { error: `Resend said: ${made.error}` };
    domain = made.data;
  }

  const { error } = await ctx.admin.from("mail_domains").insert({
    brand_id: ctx.brandId,
    name,
    resend_id: domain.id,
    status: asStatus(domain.status),
    receiving: domain.capabilities?.receiving === "enabled",
    records: domain.records ?? [],
    linked,
    verified_at: domain.status === "verified" ? new Date().toISOString() : null,
    created_by: ctx.user.id,
  });
  if (error) {
    console.error("[mail] addDomain insert failed:", error.message);
    if (!linked) await deleteDomain(domain.id); // do not leave a domain in Resend that the app does not know about; a linked one is not ours to delete
    return { error: error.code === "23505" ? "That domain is already in use." : "Could not save the domain. Try again." };
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: linked ? "mail.domain.link" : "mail.domain.add", target: name });
  refresh(ctx.slug);
  if (!linked) return { message: "Added. Add the DNS records below at your domain provider, then press Check DNS." };
  const todo = (domain.records ?? []).some((r) => r.status && r.status !== "verified");
  return { message: todo ? "Linked to the domain already in Resend. Add the DNS record below, then press Check DNS." : "Linked to the domain already in Resend. It is verified, so you can add addresses now." };
}

export async function checkDomain(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await mailContext(fd, "manage");
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const id = str(fd, "domainId");
  if (!UUID.test(id)) return { error: "Unknown domain." };
  if (!allow(`mail-check:${ctx.user.id}`, 60)) return { error: "Checked too often. Wait a few minutes." };
  const { data: row } = await ctx.admin.from("mail_domains").select("id, resend_id, status").eq("brand_id", ctx.brandId).eq("id", id).maybeSingle();
  if (!row) return { error: "Unknown domain." };

  await verifyDomain(row.resend_id as string); // asks Resend to look at the DNS again; the answer comes from the read below
  const got = await getDomain(row.resend_id as string);
  if (!got.ok) return { error: `Resend said: ${got.error}` };
  const status = asStatus(got.data.status);
  await ctx.admin
    .from("mail_domains")
    .update({
      status,
      records: got.data.records ?? [],
      receiving: got.data.capabilities?.receiving === "enabled",
      ...(status === "verified" && row.status !== "verified" ? { verified_at: new Date().toISOString() } : {}),
    })
    .eq("id", id);
  refresh(ctx.slug);
  return status === "verified" ? { message: "Verified. You can add addresses now." } : { message: "Not verified yet. DNS changes can take from a few minutes to a few hours. Check again later." };
}

export async function removeDomain(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await mailContext(fd, "manage");
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const id = str(fd, "domainId");
  if (!UUID.test(id)) return { error: "Unknown domain." };
  const { data: row } = await ctx.admin.from("mail_domains").select("id, name, resend_id, linked").eq("brand_id", ctx.brandId).eq("id", id).maybeSingle();
  if (!row) return { error: "Unknown domain." };
  if (!row.linked) await deleteDomain(row.resend_id as string); // best effort: the domain may already be gone in Resend. A linked domain stays in Resend: other projects use it
  const { error } = await ctx.admin.from("mail_domains").delete().eq("id", id);
  if (error) return { error: "Could not remove the domain. Try again." };
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "mail.domain.remove", target: row.name as string });
  refresh(ctx.slug);
  return { message: row.linked ? "Unlinked. The domain stays in Resend. Past conversations are kept." : "Domain removed. Past conversations are kept." };
}

// ---------------------------------------------------------------------------------------------- addresses
export async function addAddress(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await mailContext(fd, "manage");
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const local = str(fd, "local").trim().toLowerCase();
  const bad = localPartError(local);
  if (bad) return { error: bad };
  const domainId = str(fd, "domainId");
  if (!UUID.test(domainId)) return { error: "Pick a domain." };
  const { data: dom } = await ctx.admin.from("mail_domains").select("id, name").eq("brand_id", ctx.brandId).eq("id", domainId).maybeSingle();
  if (!dom) return { error: "Pick a domain." };
  const display = str(fd, "name").trim().slice(0, 80);
  const { error } = await ctx.admin.from("mail_addresses").insert({ brand_id: ctx.brandId, domain_id: domainId, local_part: local, display_name: display || null });
  if (error) return { error: error.code === "23505" ? "That address already exists." : "Could not add the address. Try again." };
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "mail.address.add", target: `${local}@${dom.name}` });
  refresh(ctx.slug);
  return { message: `${local}@${dom.name} added.` };
}

export async function removeAddress(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await mailContext(fd, "manage");
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const id = str(fd, "addressId");
  if (!UUID.test(id)) return { error: "Unknown address." };
  const { error } = await ctx.admin.from("mail_addresses").delete().eq("brand_id", ctx.brandId).eq("id", id);
  if (error) return { error: "Could not remove the address. Try again." };
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "mail.address.remove", target: id });
  refresh(ctx.slug);
  return { message: "Address removed. Its conversations are kept." };
}

// ---------------------------------------------------------------------------------------------- send
/** New message or a reply. For a reply the server works out who it goes to from the conversation, so the browser cannot aim it elsewhere. */
export async function sendMail(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await mailContext(fd, "edit");
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  if (!isResendReady()) return { error: "Mail is not connected yet: RESEND_API_KEY is not set on the server." };
  if (!allow(`mail-send:${ctx.user.id}`, 40)) return { error: "You have sent a lot of mail in the last hour. Try again a bit later." };

  const body = str(fd, "body").replace(/\r\n/g, "\n").trim();
  if (!body) return { error: "Write a message first." };
  if (body.length > MAIL_LIMITS.body) return { error: `Keep it under ${MAIL_LIMITS.body.toLocaleString("en")} characters.` };

  const [domains, addresses] = await Promise.all([listDomains(ctx.brandId), listAddresses(ctx.brandId)]);
  const cc = parseRecipients(str(fd, "cc"), 10);
  if (!cc.ok) return { error: cc.error };

  // Reply: the conversation decides the address, the recipients and the subject. New message: the form does.
  const threadId = str(fd, "threadId");
  let addressId = str(fd, "addressId");
  let to: string[];
  let subject: string;
  let inReplyTo: string | null = null;
  let refs: string[] = [];
  let existingThread: string | null = null;
  if (threadId) {
    if (!UUID.test(threadId)) return { error: "Unknown conversation." };
    const t = await getThread(ctx.brandId, threadId);
    if (!t) return { error: "Unknown conversation." };
    if (!t.thread.address_id) return { error: "The address of this conversation was removed, so it cannot be answered from here." };
    addressId = t.thread.address_id;
    const lastIn = [...t.messages].reverse().find((m) => m.direction === "in");
    const last = t.messages[t.messages.length - 1];
    to = lastIn ? [lastIn.from_email] : (last?.to_emails ?? []);
    if (to.length === 0) return { error: "There is nobody to answer in this conversation." };
    subject = replySubject(t.thread.subject);
    inReplyTo = last?.rfc_message_id ?? null;
    refs = messageIds(...t.messages.map((m) => m.rfc_message_id)).slice(-10);
    existingThread = threadId;
  } else {
    const parsed = parseRecipients(str(fd, "to"));
    if (!parsed.ok) return { error: parsed.error };
    if (parsed.list.length === 0) return { error: "Add at least one recipient." };
    to = parsed.list;
    subject = str(fd, "subject").replace(/[\r\n]+/g, " ").trim();
    if (!subject) return { error: "Add a subject." };
    if (subject.length > MAIL_LIMITS.subject) return { error: `Keep the subject under ${MAIL_LIMITS.subject} characters.` };
  }
  if (to.length + cc.list.length > MAIL_LIMITS.recipients) return { error: `Up to ${MAIL_LIMITS.recipients} recipients per message.` };

  const from = addresses.find((a) => a.id === addressId);
  const dom = from && domains.find((d) => d.id === from.domain_id);
  if (!from || !dom) return { error: "Pick an address to send from." };
  if (dom.status !== "verified") return { error: `${dom.name} is not verified yet. Finish its DNS records in Settings, Mailbox.` };

  const messageId = `<${randomUUID()}@${dom.name}>`;
  const html = textToHtml(body);
  const headers: Record<string, string> = { "Message-ID": messageId };
  if (inReplyTo) headers["In-Reply-To"] = inReplyTo;
  if (refs.length) headers.References = [...new Set([...refs, ...(inReplyTo ? [inReplyTo] : [])])].join(" ");
  // The same message sent twice within a minute (a double click, a retry) is one email at Resend.
  const key = createHash("sha256").update(JSON.stringify([ctx.brandId, from.email, to, cc.list, subject, body, Math.floor(Date.now() / 60_000)])).digest("hex");

  const sent = await sendEmail({ from: fromHeader(from.display_name, from.email), to, cc: cc.list, subject, text: body, html, headers }, key);
  if (!sent.ok) return { error: `The message was not sent. Resend said: ${sent.error}` };

  let tid = existingThread;
  if (!tid) {
    const { data: t, error } = await ctx.admin.from("mail_threads").insert({ brand_id: ctx.brandId, address_id: from.id, mailbox: from.email, subject: subject.slice(0, 300) }).select("id").single();
    if (error || !t) {
      console.error("[mail] sent but could not start a conversation:", error?.message);
      return { error: "The message was sent, but it could not be saved here. Do not send it again." };
    }
    tid = t.id as string;
  }
  const now = new Date().toISOString();
  const { error: insErr } = await ctx.admin.from("mail_messages").insert({
    brand_id: ctx.brandId,
    thread_id: tid,
    direction: "out",
    rfc_message_id: messageId,
    in_reply_to: inReplyTo,
    refs,
    resend_id: sent.data.id,
    from_email: from.email,
    from_name: from.display_name,
    to_emails: to,
    cc_emails: cc.list,
    subject,
    text_body: body,
    html_body: html,
    snippet: snippet(body),
    status: "sent",
    sent_by: ctx.user.id,
    occurred_at: now,
  });
  if (insErr && insErr.code !== "23505") {
    console.error("[mail] sent but could not save the message:", insErr.message);
    return { error: "The message was sent, but a copy could not be saved here. Do not send it again." };
  }
  const { count } = await ctx.admin.from("mail_messages").select("id", { count: "exact", head: true }).eq("thread_id", tid);
  await ctx.admin.from("mail_threads").update({ status: "open", unread: false, message_count: count ?? 1, last_message_at: now, last_snippet: snippet(body), last_from: from.display_name || from.email }).eq("id", tid);
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "mail.send", target: tid, meta: { recipients: to.length + cc.list.length, reply: Boolean(existingThread) } });
  refresh(ctx.slug);
  redirect(`/hub/b/${ctx.slug}/mail/${tid}`);
}

// ---------------------------------------------------------------------------------------------- conversation state
export async function setThreadStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await mailContext(fd, "edit");
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const id = str(fd, "threadId");
  const status = str(fd, "status");
  if (!UUID.test(id) || (status !== "open" && status !== "done")) return { error: "Unknown conversation." };
  const { error } = await ctx.admin.from("mail_threads").update({ status }).eq("brand_id", ctx.brandId).eq("id", id);
  if (error) return { error: "Could not update the conversation. Try again." };
  refresh(ctx.slug);
  return { message: status === "done" ? "Marked done." : "Reopened." };
}
