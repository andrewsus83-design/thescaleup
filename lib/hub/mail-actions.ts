"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "./actions";
import { getThread, listAddresses, listDomains } from "./mail/data";
import { parseFileRefs } from "./mail/forward";
import { copyForwarded, forwardDeps } from "./mail/forward-files";
import { ATTACH_LIMITS, attachError, safeFilename, storageKey } from "./mail/files";
import { MAIL_LIMITS, domainError, fromHeader, localPartError, messageIds, parseRecipients, replySubject, snippet, textToHtml } from "./mail/model";
import { createDomain, deleteDomain, enableReceiving, findDomain, getDomain, isResendReady, sendEmail, verifyDomain, type ResendDomain } from "./mail/resend";
import { atLeast } from "./permissions";
import { allow } from "./ratelimit";
import { deleteObject, isR2Ready, objectSize, signedUrl } from "./storage/r2";
import { canManageTeam, safeNext } from "./rules";
import { audit } from "./session";
import { UUID, str, taskContext, type Ctx } from "./tasks/context";

const refresh = (slug: string) => revalidatePath(`/hub/b/${slug}`, "layout");

/** Who is asking, what they are in this brand, and what the access matrix gives them on Mail. */
async function mailContext(fd: FormData, need: "view" | "edit" | "manage"): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  return mailAccess(str(fd, "brandId"), need);
}

async function mailAccess(brandId: string, need: "view" | "edit" | "manage"): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const c = await taskContext(brandId, "mail");
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

  // Files: the browser already uploaded them to storage. Here each one is checked to be this person's, unsent and really there.
  const picked = [...new Set(fd.getAll("attachmentId").filter((v): v is string => typeof v === "string" && v !== ""))];
  if (picked.length > ATTACH_LIMITS.files) return { error: `Up to ${ATTACH_LIMITS.files} files per message.` };
  if (!picked.every((id) => UUID.test(id))) return { error: "An attachment is no longer available. Attach it again." };
  // A forward can carry the original's files. They are copied into new unsent files first, so from here on they are like uploads.
  const fwd = parseFileRefs(fd.getAll("fwd"));
  if (!fwd.ok) return { error: fwd.error };
  if (picked.length + fwd.list.length > ATTACH_LIMITS.files) return { error: `Up to ${ATTACH_LIMITS.files} files per message.` };
  let copies: string[] = [];
  if (fwd.list.length > 0) {
    if (!isR2Ready()) return { error: "Attachments are not turned on yet: file storage is not set up on the server." };
    const made = await copyForwarded(forwardDeps(ctx.admin, ctx.brandId, ctx.user.id), ctx.brandId, fwd.list, picked.length);
    if (!made.ok) return { error: made.error };
    copies = made.ids;
  }
  const wanted = [...picked, ...copies];
  // Copies are made for this one send: when it stops before the message goes out they are removed, so a retry starts clean.
  const stop = async (error: string): Promise<FormState> => {
    const del = forwardDeps(ctx.admin, ctx.brandId, ctx.user.id).forget;
    if (copies.length > 0) {
      const { data: rows } = await ctx.admin.from("mail_attachments").select("id, storage_key").eq("brand_id", ctx.brandId).in("id", copies);
      for (const r of rows ?? []) await del(r.id as string, r.storage_key as string);
    }
    return { error };
  };
  let files: { id: string; filename: string; content_type: string; size: number; storage_key: string }[] = [];
  const outFiles: { filename: string; path: string; contentType: string }[] = [];
  if (wanted.length > 0) {
    if (!isR2Ready()) return { error: "Attachments are not turned on yet: file storage is not set up on the server." };
    const { data: rows } = await ctx.admin.from("mail_attachments").select("id, filename, content_type, size, storage_key").eq("brand_id", ctx.brandId).eq("uploaded_by", ctx.user.id).is("message_id", null).in("id", wanted);
    files = (rows ?? []) as typeof files;
    if (files.length !== wanted.length) return stop("An attachment is no longer available. Attach it again.");
    if (files.reduce((n, f) => n + Number(f.size), 0) > ATTACH_LIMITS.bytes) return stop(`A message can carry up to ${ATTACH_LIMITS.bytes / 1024 / 1024} MB of files in total.`);
    for (const f of files) {
      const there = await objectSize(f.storage_key);
      if (there === null) return stop(`${f.filename} did not finish uploading. Remove it and attach it again.`);
      if (there > ATTACH_LIMITS.bytes || there !== Number(f.size)) return stop(`${f.filename} is not the file that was selected. Remove it and attach it again.`);
      const link = signedUrl("GET", f.storage_key, 1800);
      if (!link) return stop("Attachments are not turned on yet: file storage is not set up on the server.");
      outFiles.push({ filename: f.filename, path: link, contentType: f.content_type });
    }
  }

  const messageId = `<${randomUUID()}@${dom.name}>`;
  const html = textToHtml(body);
  const headers: Record<string, string> = { "Message-ID": messageId };
  if (inReplyTo) headers["In-Reply-To"] = inReplyTo;
  if (refs.length) headers.References = [...new Set([...refs, ...(inReplyTo ? [inReplyTo] : [])])].join(" ");
  // The same message sent twice within a minute (a double click, a retry) is one email at Resend.
  const key = createHash("sha256").update(JSON.stringify([ctx.brandId, from.email, to, cc.list, subject, body, picked.slice().sort(), fwd.list.map((r) => `${r.messageId}:${r.attachmentId}`).sort(), Math.floor(Date.now() / 60_000)])).digest("hex");

  const sent = await sendEmail({ from: fromHeader(from.display_name, from.email), to, cc: cc.list, subject, text: body, html, headers, attachments: outFiles }, key);
  if (!sent.ok) return stop(`The message was not sent. Resend said: ${sent.error}`);

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
  const { data: saved, error: insErr } = await ctx.admin
    .from("mail_messages")
    .insert({
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
      attachments: files.map((f) => ({ id: f.id, filename: f.filename, content_type: f.content_type, size: Number(f.size) })),
    })
    .select("id")
    .single();
  if (insErr && insErr.code !== "23505") {
    console.error("[mail] sent but could not save the message:", insErr.message);
    return { error: "The message was sent, but a copy could not be saved here. Do not send it again." };
  }
  if (saved && files.length > 0) {
    const { error: linkErr } = await ctx.admin.from("mail_attachments").update({ message_id: saved.id }).in("id", files.map((f) => f.id));
    if (linkErr) console.error("[mail] sent but could not link the attachments:", linkErr.message);
  }
  const { count } = await ctx.admin.from("mail_messages").select("id", { count: "exact", head: true }).eq("thread_id", tid);
  await ctx.admin.from("mail_threads").update({ status: "open", unread: false, message_count: count ?? 1, last_message_at: now, last_snippet: snippet(body), last_from: from.display_name || from.email }).eq("id", tid);
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "mail.send", target: tid, meta: { recipients: to.length + cc.list.length, reply: Boolean(existingThread), files: files.length } });
  refresh(ctx.slug);
  redirect(`/hub/b/${ctx.slug}/mail/${tid}`);
}

// ---------------------------------------------------------------------------------------------- conversation state
const OPS = { done: { status: "done" }, open: { status: "open" }, read: { unread: false }, unread: { unread: true }, trash: { status: "trash" }, restore: { status: "open" } } as const;
const DONE_MESSAGE: Record<string, string> = { trash: "Moved to Trash.", restore: "Restored to the inbox." };

/**
 * Done, reopen, mark read or unread, delete into Trash and restore from it, for the conversations ticked in the list ("act" is the action) or for one row ("act" is
 * "action:threadId"). From the conversation page "back" is where to go afterwards. Read state is shared by the whole team.
 */
export async function setThreadsState(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await mailContext(fd, "edit");
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const [op, one] = str(fd, "act").split(":");
  const patch = Object.hasOwn(OPS, op) ? OPS[op as keyof typeof OPS] : undefined;
  if (!patch) return { error: "Unknown action." };
  const ids = one ? [one] : fd.getAll("id").filter((v): v is string => typeof v === "string");
  if (ids.length === 0) return { error: "Tick a conversation first." };
  if (ids.length > 100 || !ids.every((id) => UUID.test(id))) return { error: "Unknown conversation." };
  // Only Restore brings a deleted conversation back; Done and Reopen leave what is in Trash alone, and Restore touches only what is there.
  let q = ctx.admin.from("mail_threads").update(patch).eq("brand_id", ctx.brandId).in("id", ids);
  q = op === "restore" ? q.eq("status", "trash") : op === "read" || op === "unread" ? q : q.neq("status", "trash");
  const { data: changed, error } = await q.select("id");
  if (error) return { error: "Could not update the conversations. Try again." };
  if (op === "trash" || op === "restore") await audit({ actor: ctx.user, brandId: ctx.brandId, action: `mail.${op}`, target: ids.length === 1 ? ids[0] : undefined, meta: { count: changed?.length ?? 0 } });
  refresh(ctx.slug);
  const back = safeNext(str(fd, "back"), "");
  if (back.startsWith(`/hub/b/${ctx.slug}/mail`)) redirect(back);
  return { message: DONE_MESSAGE[op] ?? "Updated." };
}

// ---------------------------------------------------------------------------------------------- delete for good
const chunks = <T,>(xs: T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const PURGE_AT_ONCE = 200;

/**
 * Deletes conversations from Trash for good: their messages, their files in storage and their records. It only touches what is
 * already in Trash, so a forged request cannot remove live mail. The founder or the agency only; "purge" is the ticked
 * conversations (or "purge:id" from the conversation page), "purge-all" is everything in Trash, up to 200 at a time.
 */
export async function purgeThreads(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await mailContext(fd, "edit");
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  if (!canManageTeam(ctx.actor)) return { error: "Only the founder or the agency can delete mail for good. Anyone with access can move it to Trash." };
  if (!allow(`mail-purge:${ctx.user.id}`, 30)) return { error: "You have deleted a lot in the last hour. Try again a bit later." };
  const [op, one] = str(fd, "act").split(":");
  let ids: string[];
  if (op === "purge-all") {
    const { data } = await ctx.admin.from("mail_threads").select("id").eq("brand_id", ctx.brandId).eq("status", "trash").order("last_message_at", { ascending: false }).limit(PURGE_AT_ONCE);
    ids = (data ?? []).map((r) => r.id as string);
  } else if (op === "purge") {
    ids = one ? [one] : fd.getAll("id").filter((v): v is string => typeof v === "string");
    if (ids.length === 0) return { error: "Tick a conversation first." };
    if (ids.length > 100 || !ids.every((id) => UUID.test(id))) return { error: "Unknown conversation." };
  } else return { error: "Unknown action." };
  if (ids.length === 0) return { message: "Trash is empty." };

  const { data: inTrash } = await ctx.admin.from("mail_threads").select("id").eq("brand_id", ctx.brandId).eq("status", "trash").in("id", ids);
  const doomed = (inTrash ?? []).map((r) => r.id as string);
  if (doomed.length === 0) return { error: "Only conversations in Trash can be deleted for good." };

  // Files first (to know their keys), then the conversations, then the files: if the conversations cannot be deleted, no file is lost.
  const messageIds: string[] = [];
  for (const part of chunks(doomed, 50)) {
    const { data } = await ctx.admin.from("mail_messages").select("id").eq("brand_id", ctx.brandId).in("thread_id", part);
    messageIds.push(...(data ?? []).map((r) => r.id as string));
  }
  const files: { id: string; storage_key: string }[] = [];
  for (const part of chunks(messageIds, 100)) {
    const { data } = await ctx.admin.from("mail_attachments").select("id, storage_key").eq("brand_id", ctx.brandId).in("message_id", part);
    files.push(...((data ?? []) as typeof files));
  }
  const { error } = await ctx.admin.from("mail_threads").delete().eq("brand_id", ctx.brandId).eq("status", "trash").in("id", doomed);
  if (error) {
    console.error("[mail] could not delete for good:", error.message);
    return { error: "Could not delete the conversations. Try again." };
  }
  let kept = 0;
  for (const part of chunks(files, 20)) {
    const gone = await Promise.all(part.map((f) => deleteObject(f.storage_key)));
    kept += gone.filter((ok) => !ok).length;
    const okIds = part.filter((_, i) => gone[i]).map((f) => f.id);
    if (okIds.length > 0) await ctx.admin.from("mail_attachments").delete().eq("brand_id", ctx.brandId).in("id", okIds);
  }
  if (kept > 0) console.error(`[mail] ${kept} file(s) could not be removed from storage after a delete; their records are kept for a later cleanup.`);
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "mail.purge", target: doomed.length === 1 ? doomed[0] : undefined, meta: { conversations: doomed.length, files: files.length } });
  refresh(ctx.slug);
  const back = safeNext(str(fd, "back"), "");
  if (back.startsWith(`/hub/b/${ctx.slug}/mail`)) redirect(back);
  const more = op === "purge-all" && doomed.length === PURGE_AT_ONCE;
  return { message: `Deleted ${doomed.length} ${doomed.length === 1 ? "conversation" : "conversations"} for good.${more ? " There may be more in Trash: press Empty Trash again." : ""}` };
}

// ---------------------------------------------------------------------------------------------- attachments
export type UploadTicket = { ok: true; id: string; url: string; contentType: string } | { ok: false; error: string };

/**
 * Step one of attaching a file: the browser says what it is about to upload, the server checks it and hands back a link that allows
 * exactly one upload to exactly one place for ten minutes. Step two (the upload itself) goes straight to storage.
 */
export async function prepareUpload(input: { brandId: string; name: string; type: string; size: number; count: number; total: number }): Promise<UploadTicket> {
  const c = await mailAccess(typeof input?.brandId === "string" ? input.brandId : "", "edit");
  if (!c.ok) return c;
  const { ctx } = c;
  if (!isR2Ready()) return { ok: false, error: "Attachments are not turned on yet: file storage is not set up on the server." };
  const name = typeof input.name === "string" ? safeFilename(input.name) : "";
  const size = Number(input.size);
  const bad = attachError(name || "file", size, Number(input.count) || 0, Number(input.total) || 0);
  if (!name || bad) return { ok: false, error: bad ?? "That file cannot be attached." };
  if (!allow(`mail-upload:${ctx.user.id}`, 80)) return { ok: false, error: "You have attached a lot of files in the last hour. Try again a bit later." };
  const contentType = typeof input.type === "string" && /^[\w.+-]+\/[\w.+-]+$/.test(input.type) && input.type.length <= 100 ? input.type.toLowerCase() : "application/octet-stream";

  const id = randomUUID();
  const key = storageKey(ctx.brandId, id, name);
  const { error } = await ctx.admin.from("mail_attachments").insert({ id, brand_id: ctx.brandId, uploaded_by: ctx.user.id, filename: name, content_type: contentType, size, storage_key: key });
  if (error) {
    console.error("[mail] could not record an upload:", error.message);
    return { ok: false, error: "Could not start the upload. Try again." };
  }
  const url = signedUrl("PUT", key, 600);
  if (!url) return { ok: false, error: "Attachments are not turned on yet: file storage is not set up on the server." };
  return { ok: true, id, url, contentType };
}

/** The person removed a file before sending: forget it and delete it from storage. Only your own unsent uploads can be removed this way. */
export async function discardUpload(brandId: string, id: string): Promise<{ ok: boolean }> {
  const c = await mailAccess(brandId, "edit");
  if (!c.ok || typeof id !== "string" || !UUID.test(id)) return { ok: false };
  const { data: row } = await c.ctx.admin.from("mail_attachments").select("id, storage_key").eq("brand_id", c.ctx.brandId).eq("uploaded_by", c.ctx.user.id).is("message_id", null).eq("id", id).maybeSingle();
  if (!row) return { ok: true };
  await deleteObject(row.storage_key as string);
  await c.ctx.admin.from("mail_attachments").delete().eq("id", id);
  return { ok: true };
}
