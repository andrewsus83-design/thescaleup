import "server-only";

// Resend over fetch, for domains, sending and reading received mail. Uses RESEND_API_KEY, the agency's one account:
// every brand's domain lives in it. Webhook calls come in through app/api/mail/resend (RESEND_WEBHOOK_SECRET).

const BASE = "https://api.resend.com";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

export const isResendReady = () => Boolean(process.env.RESEND_API_KEY);

async function call<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown, idempotencyKey?: string): Promise<Result<T>> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "Mail is not connected yet: RESEND_API_KEY is not set on the server." };
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      const message = typeof json?.message === "string" ? json.message : `Resend answered ${res.status}.`;
      return { ok: false, error: message.slice(0, 300), status: res.status };
    }
    return { ok: true, data: json as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "TimeoutError" ? "Resend did not answer in time. Try again." : "Could not reach Resend. Try again." };
  }
}

export type DnsRecord = { record: string; name: string; type: string; ttl?: string; status?: string; value: string; priority?: number };
export type ResendDomain = { id: string; name: string; status: string; capabilities?: { sending?: string; receiving?: string }; records?: DnsRecord[] };

export const createDomain = (name: string, receiving: boolean) =>
  call<ResendDomain>("POST", "/domains", { name, capabilities: { sending: "enabled", receiving: receiving ? "enabled" : "disabled" } });
export const getDomain = (id: string) => call<ResendDomain>("GET", `/domains/${encodeURIComponent(id)}`);
/** Turns receiving on for a domain that was created without it. Sending is left as it is. */
export const enableReceiving = (id: string) => call<{ id: string }>("PATCH", `/domains/${encodeURIComponent(id)}`, { capabilities: { receiving: "enabled" } });

/**
 * Finds a domain by name in the Resend account, or null when the account does not have it. Reads up to 10 pages of 100,
 * which is far more domains than one agency has; a failed read comes back as an error so the caller can fall back.
 * Two entries can share a name (a leftover from a second attempt): the verified one wins, because it is the one that works.
 */
export async function findDomain(name: string): Promise<Result<ResendDomain | null>> {
  const hits: ResendDomain[] = [];
  let after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const q = new URLSearchParams({ limit: "100" });
    if (after) q.set("after", after);
    const got = await call<{ data?: ResendDomain[]; has_more?: boolean }>("GET", `/domains?${q}`);
    if (!got.ok) return got;
    const rows = got.data.data ?? [];
    hits.push(...rows.filter((d) => d.name?.toLowerCase() === name));
    if (!got.data.has_more || rows.length === 0) break;
    after = rows[rows.length - 1].id;
  }
  return { ok: true, data: hits.find((d) => d.status === "verified") ?? hits[0] ?? null };
}

export const verifyDomain = (id: string) => call<{ id: string }>("POST", `/domains/${encodeURIComponent(id)}/verify`);
export const deleteDomain = (id: string) => call<{ id: string }>("DELETE", `/domains/${encodeURIComponent(id)}`);

/** A file for Resend to fetch itself from a link, so it never passes through this server. */
export type SendAttachment = { filename: string; path: string; contentType: string };
export type SendInput = { from: string; to: string[]; cc?: string[]; subject: string; text: string; html: string; headers?: Record<string, string>; replyTo?: string; attachments?: SendAttachment[] };
export const sendEmail = (m: SendInput, idempotencyKey: string) =>
  call<{ id: string }>(
    "POST",
    "/emails",
    {
      from: m.from,
      to: m.to,
      cc: m.cc?.length ? m.cc : undefined,
      subject: m.subject,
      text: m.text,
      html: m.html,
      headers: m.headers,
      reply_to: m.replyTo,
      attachments: m.attachments?.length ? m.attachments.map((a) => ({ filename: a.filename, path: a.path, content_type: a.contentType })) : undefined,
    },
    idempotencyKey,
  );

/** Up to 100 emails in one request (no attachments). The ids come back in the order they were sent. One bad email fails the whole request. */
export const sendBatch = (items: SendInput[], idempotencyKey: string) =>
  call<{ data: { id: string }[] }>(
    "POST",
    "/emails/batch",
    items.map((m) => ({ from: m.from, to: m.to, subject: m.subject, text: m.text, html: m.html, headers: m.headers, reply_to: m.replyTo })),
    idempotencyKey,
  );

export type ReceivedAttachment = { id: string; filename?: string | null; content_type?: string | null; content_disposition?: string | null; content_id?: string | null; size?: number | null };
export type ReceivedEmail = {
  id: string;
  from: string;
  to: string[];
  cc?: string[] | null;
  subject?: string | null;
  html?: string | null;
  text?: string | null;
  headers?: Record<string, string> | null;
  message_id?: string | null;
  created_at?: string;
  attachments?: ReceivedAttachment[] | null;
};
export const getReceivedEmail = (id: string) => call<ReceivedEmail>("GET", `/emails/receiving/${encodeURIComponent(id)}`);

/** A short-lived download link for one attachment of a received email. */
export const getReceivedAttachment = (emailId: string, attachmentId: string) =>
  call<{ download_url?: string; filename?: string }>("GET", `/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachmentId)}`);
