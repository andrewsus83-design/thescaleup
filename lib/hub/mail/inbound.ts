import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MAIL_LIMITS, htmlToText, messageIds, moveStatus, normalizeSubject, parseAddress, snippet } from "./model";
import { getReceivedEmail } from "./resend";

// What happens when Resend tells us about mail: a message arrived for one of the brands' addresses, or an email we sent
// was delivered, bounced and so on. Resend delivers at least once, so everything here must be safe to run twice.

const db = () => createSupabaseAdminClient();

/** Header lookup that ignores case: mail servers write In-Reply-To, in-reply-to and IN-REPLY-TO. */
const header = (h: Record<string, string> | null | undefined, name: string): string | null => {
  if (!h) return null;
  const key = Object.keys(h).find((k) => k.toLowerCase() === name);
  return key ? h[key] : null;
};

export type IngestResult = "stored" | "duplicate" | "ignored" | "retry";

export async function ingestReceived(emailId: string): Promise<IngestResult> {
  const admin = db();
  const { data: dup } = await admin.from("mail_messages").select("id").eq("resend_id", emailId).maybeSingle();
  if (dup) return "duplicate";

  const got = await getReceivedEmail(emailId);
  if (!got.ok) {
    console.error("[mail] could not read received email:", got.error);
    return "retry"; // Resend keeps the mail, so asking again later is safe
  }
  const mail = got.data;

  // Which of the brands' addresses is this for? Mail to a domain we do not manage, or to an address nobody set up, is ignored.
  const recipients = [...(mail.to ?? []), ...(mail.cc ?? [])].map((r) => parseAddress(r)).filter((r): r is { email: string; name: string } => r !== null);
  const domainNames = [...new Set(recipients.map((r) => r.email.split("@")[1]))];
  if (domainNames.length === 0) return "ignored";
  const { data: doms } = await admin.from("mail_domains").select("id, brand_id, name").in("name", domainNames).eq("receiving", true);
  if (!doms?.length) return "ignored";
  const { data: addrs } = await admin.from("mail_addresses").select("id, brand_id, domain_id, local_part, display_name").in("domain_id", doms.map((d) => d.id as string));
  let target: { id: string; brand_id: string; email: string } | null = null;
  for (const r of recipients) {
    const [local, domain] = r.email.split("@");
    const dom = doms.find((d) => d.name === domain);
    const addr = dom && addrs?.find((a) => a.domain_id === dom.id && a.local_part === local.split("+")[0]);
    if (addr) {
      target = { id: addr.id as string, brand_id: addr.brand_id as string, email: `${addr.local_part}@${domain}` };
      break;
    }
  }
  if (!target) return "ignored";

  const from = parseAddress(header(mail.headers, "from") ?? mail.from) ?? parseAddress(mail.from);
  if (!from) return "ignored";
  const subject = (mail.subject ?? "").slice(0, MAIL_LIMITS.subject * 1.5);
  const text = (mail.text?.trim() ? mail.text : mail.html ? htmlToText(mail.html) : "").slice(0, MAIL_LIMITS.storedText);
  const html = mail.html ? mail.html.slice(0, MAIL_LIMITS.storedHtml) : null;
  const inReplyTo = messageIds(header(mail.headers, "in-reply-to"))[0] ?? null;
  const refs = messageIds(header(mail.headers, "references")).slice(-20);
  const brandId = target.brand_id;

  // The conversation: the message this one answers, else the same subject with the same person in the last 30 days, else a new one.
  let threadId: string | null = null;
  const ids = messageIds(header(mail.headers, "in-reply-to"), header(mail.headers, "references"));
  if (ids.length) {
    const { data } = await admin.from("mail_messages").select("thread_id").eq("brand_id", brandId).in("rfc_message_id", ids).limit(1).maybeSingle();
    threadId = (data?.thread_id as string | undefined) ?? null;
  }
  if (!threadId) {
    const want = normalizeSubject(subject);
    if (want) {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data: recent } = await admin.from("mail_threads").select("id, subject").eq("brand_id", brandId).eq("address_id", target.id).gte("last_message_at", since).order("last_message_at", { ascending: false }).limit(50);
      const cands = (recent ?? []).filter((t) => normalizeSubject(t.subject as string) === want).map((t) => t.id as string);
      if (cands.length) {
        const [a, b] = await Promise.all([
          admin.from("mail_messages").select("thread_id").in("thread_id", cands).eq("from_email", from.email).limit(1),
          admin.from("mail_messages").select("thread_id").in("thread_id", cands).contains("to_emails", [from.email]).limit(1),
        ]);
        threadId = (a.data?.[0]?.thread_id as string | undefined) ?? (b.data?.[0]?.thread_id as string | undefined) ?? null;
      }
    }
  }
  let created = false;
  if (!threadId) {
    const { data: t, error } = await admin.from("mail_threads").insert({ brand_id: brandId, address_id: target.id, mailbox: target.email, subject: subject.slice(0, 300) }).select("id").single();
    if (error || !t) {
      console.error("[mail] could not start a conversation:", error?.message);
      return "retry";
    }
    threadId = t.id as string;
    created = true;
  }

  const occurred = mail.created_at && !Number.isNaN(Date.parse(mail.created_at)) ? new Date(mail.created_at).toISOString() : new Date().toISOString();
  const { error: insErr } = await admin.from("mail_messages").insert({
    brand_id: brandId,
    thread_id: threadId,
    direction: "in",
    rfc_message_id: mail.message_id ?? null,
    in_reply_to: inReplyTo,
    refs,
    resend_id: emailId,
    from_email: from.email,
    from_name: from.name || null,
    to_emails: (mail.to ?? []).map((r) => parseAddress(r)?.email ?? r).slice(0, 50),
    cc_emails: (mail.cc ?? []).map((r) => parseAddress(r)?.email ?? r).slice(0, 50),
    subject: subject.slice(0, 300),
    text_body: text,
    html_body: html,
    snippet: snippet(text),
    attachments: (mail.attachments ?? []).slice(0, 30).map((a) => ({ id: a.id, filename: a.filename ?? null, content_type: a.content_type ?? null, size: a.size ?? null })),
    status: "received",
    occurred_at: occurred,
  });
  if (insErr) {
    if (created) await admin.from("mail_threads").delete().eq("id", threadId);
    if (insErr.code === "23505") return "duplicate"; // a parallel delivery stored it first
    console.error("[mail] could not store the message:", insErr.message);
    return "retry";
  }

  const { count } = await admin.from("mail_messages").select("id", { count: "exact", head: true }).eq("thread_id", threadId);
  await admin
    .from("mail_threads")
    .update({ unread: true, status: "open", message_count: count ?? 1, last_message_at: occurred, last_snippet: snippet(text), last_from: from.name || from.email })
    .eq("id", threadId);
  return "stored";
}

const EVENT_STATUS: Record<string, string> = { "email.sent": "sent", "email.delivered": "delivered", "email.bounced": "bounced", "email.complained": "complained", "email.failed": "failed" };

/** Delivery news about an email we sent. Unknown ids (mail sent by other parts of the app) are ignored. */
export async function applyDeliveryEvent(type: string, data: { email_id?: string; bounce?: { message?: string }; failed?: { reason?: string } }): Promise<void> {
  const next = EVENT_STATUS[type];
  if (!next || !data.email_id) return;
  const admin = db();
  const { data: row } = await admin.from("mail_messages").select("id, status").eq("resend_id", data.email_id).eq("direction", "out").maybeSingle();
  if (!row) return;
  const status = moveStatus(row.status as string, next);
  if (status === row.status) return;
  const error = status === "bounced" ? (data.bounce?.message ?? null) : status === "failed" ? (data.failed?.reason ?? null) : null;
  await admin.from("mail_messages").update({ status, error: error ? error.slice(0, 300) : null }).eq("id", row.id);
}
