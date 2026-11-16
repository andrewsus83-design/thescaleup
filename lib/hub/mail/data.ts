import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Folder } from "./model";
import type { DnsRecord } from "./resend";

// Reads for the Mail pages. They use the service role, so every function takes the brand id and filters on it: the caller
// has already checked that this person may open Mail in this brand.

export type MailDomain = { id: string; name: string; status: string; receiving: boolean; records: DnsRecord[]; verified_at: string | null; created_at: string; linked: boolean };
export type MailAddress = { id: string; domain_id: string; local_part: string; display_name: string | null; email: string; domain: string };
export type ThreadRow = { id: string; address_id: string | null; mailbox: string; subject: string; status: "open" | "done"; unread: boolean; message_count: number; last_message_at: string; last_snippet: string; last_from: string; to?: string };
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

export const PAGE = 50;
const THREAD_COLS = "id, address_id, mailbox, subject, status, unread, message_count, last_message_at, last_snippet, last_from";

/**
 * One page of conversations, newest first. A search looks in every folder except Sent (like Gmail's "All Mail"): the subject, the
 * sender, the preview and the text of every message. Sent lists the conversations we wrote in, with who the last message went to.
 */
export async function listThreads(brandId: string, opts: { folder: Folder; addressId?: string; q?: string; before?: string; limit?: number }): Promise<ThreadRow[]> {
  let sentTo: Map<string, string> | null = null;
  if (opts.folder === "sent") {
    const { data } = await db().from("mail_messages").select("thread_id, to_emails").eq("brand_id", brandId).eq("direction", "out").order("occurred_at", { ascending: false }).limit(300);
    sentTo = new Map();
    for (const r of data ?? []) {
      const to = (r.to_emails as string[] | null) ?? [];
      if (!sentTo.has(r.thread_id as string) && to.length > 0) sentTo.set(r.thread_id as string, to.length > 1 ? `${to[0]} +${to.length - 1}` : to[0]);
    }
    if (sentTo.size === 0) return [];
  }
  // The ids go into the request address, so only the newest few are used: enough for a page, and the address stays short.
  let hits: string[] = [];
  if (opts.q) {
    const t = opts.q;
    const { data } = await db().from("mail_messages").select("thread_id").eq("brand_id", brandId).or(`text_body.ilike.%${t}%,from_email.ilike.%${t}%,subject.ilike.%${t}%`).order("occurred_at", { ascending: false }).limit(200);
    hits = [...new Set((data ?? []).map((r) => r.thread_id as string))].slice(0, 100);
  }
  let q = db()
    .from("mail_threads")
    .select(THREAD_COLS)
    .eq("brand_id", brandId)
    .order("last_message_at", { ascending: false })
    .limit(opts.limit ?? PAGE);
  if (!opts.q && opts.folder !== "sent") q = q.eq("status", opts.folder === "done" ? "done" : "open");
  if (sentTo) q = q.in("id", [...sentTo.keys()].slice(0, 150));
  if (opts.addressId) q = q.eq("address_id", opts.addressId);
  if (opts.before) q = q.lt("last_message_at", opts.before);
  if (opts.q) {
    const t = opts.q;
    const parts = [`subject.ilike.%${t}%`, `last_from.ilike.%${t}%`, `last_snippet.ilike.%${t}%`];
    if (hits.length > 0) parts.push(`id.in.(${hits.join(",")})`);
    q = q.or(parts.join(","));
  }
  const { data } = await q;
  const rows = (data ?? []) as ThreadRow[];
  return sentTo ? rows.map((r) => ({ ...r, to: sentTo.get(r.id) })) : rows;
}

export async function countUnread(brandId: string): Promise<number> {
  const { count } = await db().from("mail_threads").select("id", { count: "exact", head: true }).eq("brand_id", brandId).eq("status", "open").eq("unread", true);
  return count ?? 0;
}

export async function getThread(brandId: string, threadId: string): Promise<{ thread: ThreadRow; messages: MessageRow[] } | null> {
  const { data: thread } = await db()
    .from("mail_threads")
    .select(THREAD_COLS)
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
