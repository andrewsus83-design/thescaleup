import "server-only";

// Resend over fetch, for domains, sending and reading received mail. Uses RESEND_API_KEY, the agency's one account:
// every brand's domain lives in it. Webhook calls come in through app/api/mail/resend (RESEND_WEBHOOK_SECRET).

const BASE = "https://api.resend.com";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export const isResendReady = () => Boolean(process.env.RESEND_API_KEY);

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown, idempotencyKey?: string): Promise<Result<T>> {
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
      return { ok: false, error: message.slice(0, 300) };
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
export const verifyDomain = (id: string) => call<{ id: string }>("POST", `/domains/${encodeURIComponent(id)}/verify`);
export const deleteDomain = (id: string) => call<{ id: string }>("DELETE", `/domains/${encodeURIComponent(id)}`);

export type SendInput = { from: string; to: string[]; cc?: string[]; subject: string; text: string; html: string; headers?: Record<string, string>; replyTo?: string };
export const sendEmail = (m: SendInput, idempotencyKey: string) =>
  call<{ id: string }>("POST", "/emails", { from: m.from, to: m.to, cc: m.cc?.length ? m.cc : undefined, subject: m.subject, text: m.text, html: m.html, headers: m.headers, reply_to: m.replyTo }, idempotencyKey);

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
