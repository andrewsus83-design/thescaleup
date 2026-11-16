import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DnsRecord } from "./resend";

// Reads for the Mail pages. They use the service role, so every function takes the brand id and filters on it: the caller
// has already checked that this person may open Mail in this brand.

export type MailDomain = { id: string; name: string; status: string; receiving: boolean; records: DnsRecord[]; verified_at: string | null; created_at: string; linked: boolean };
export type MailAddress = { id: string; domain_id: string; local_part: string; display_name: string | null; email: string; domain: string };
export type ThreadRow = { id: string; address_id: string | null; mailbox: string; subject: string; status: "open" | "done"; unread: boolean; message_count: number; last_message_at: string; last_snippet: string; last_from: string };
export type Attachment = { id: string; filename?: string | null; content_type?: string | null; size?: number | null };
export type MessageRow = {
  id: string;
  thread_id: string;
  direction: "in" | "out";
  rfc_message_id: string | null;
  resend_id: string | null;
  from_email: string;
  from_name: string | null;
  to_emails: string[];
  cc_emails: string[];
  subject: string;
  text_body: string;
  html_body: string | null;
  attachments: Attachment[];
  status: string;
  error: string | null;
  occurred_at: string;
};

const db = () => createSupabaseAdminClient();

export async function listDomains(brandId: string): Promise<MailDomain[]> {
  const { data } = await db().from("mail_domains").select("id, name, status, receiving, records, verified_at, created_at, linked").eq("brand_id", brandId).order("created_at");
  return (data ?? []) as MailDomain[];
}

export async function listAddresses(brandId: string, domains?: MailDomain[]): Promise<MailAddress[]> {
  const [{ data }, doms] = await Promise.all([db().from("mail_addresses").select("id, domain_id, local_part, display_name").eq("brand_id", brandId).order("local_part"), domains ?? listDomains(brandId)]);
  const name = new Map(doms.map((d) => [d.id, d.name]));
  return (data ?? [])
    .filter((a) => name.has(a.domain_id as string))
    .map((a) => ({ ...(a as Omit<MailAddress, "email" | "domain">), domain: name.get(a.domain_id as string)!, email: `${a.local_part}@${name.get(a.domain_id as string)}` }));
}

/** Addresses mail can be sent from: their domain finished DNS verification. */
export const sendable = (addresses: MailAddress[], domains: MailDomain[]) => {
  const ok = new Set(domains.filter((d) => d.status === "verified").map((d) => d.id));
  return addresses.filter((a) => ok.has(a.domain_id));
};

export async function listThreads(brandId: string, opts: { status: "open" | "done"; addressId?: string; limit?: number }): Promise<ThreadRow[]> {
  let q = db()
    .from("mail_threads")
    .select("id, address_id, mailbox, subject, status, unread, message_count, last_message_at, last_snippet, last_from")
    .eq("brand_id", brandId)
    .eq("status", opts.status)
    .order("last_message_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.addressId) q = q.eq("address_id", opts.addressId);
  const { data } = await q;
  return (data ?? []) as ThreadRow[];
}

export async function countUnread(brandId: string): Promise<number> {
  const { count } = await db().from("mail_threads").select("id", { count: "exact", head: true }).eq("brand_id", brandId).eq("status", "open").eq("unread", true);
  return count ?? 0;
}

export async function getThread(brandId: string, threadId: string): Promise<{ thread: ThreadRow; messages: MessageRow[] } | null> {
  const { data: thread } = await db()
    .from("mail_threads")
    .select("id, address_id, mailbox, subject, status, unread, message_count, last_message_at, last_snippet, last_from")
    .eq("brand_id", brandId)
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return null;
  const { data: messages } = await db()
    .from("mail_messages")
    .select("id, thread_id, direction, rfc_message_id, resend_id, from_email, from_name, to_emails, cc_emails, subject, text_body, html_body, attachments, status, error, occurred_at")
    .eq("brand_id", brandId)
    .eq("thread_id", threadId)
    .order("occurred_at");
  return { thread: thread as ThreadRow, messages: (messages ?? []) as MessageRow[] };
}
