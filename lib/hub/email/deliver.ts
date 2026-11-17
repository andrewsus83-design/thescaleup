import { createHash } from "node:crypto";

// Sends one batch of campaign emails and says what happened to each. Pure apart from the `send` it is given, so it can be tested.

export type Delivered = { id?: string; error?: string };
export type Sender<T> = (items: T[], idempotencyKey: string) => Promise<{ ok: true; data: { data?: { id: string }[] } } | { ok: false; error: string; status?: number }>;

/**
 * Sends the emails in one request. If Resend refuses the request itself (one address it does not accept fails the whole batch), the batch is
 * split in half and each half tried again, down to single emails, so one bad address costs one email and not fifty. "retry" means Resend is
 * busy or down: nothing is decided, and the caller tries again later with the same key, so what was already taken is not sent twice.
 */
export async function deliver<T>(send: Sender<T>, campaignId: string, emails: T[], ids: string[]): Promise<Delivered[] | "retry"> {
  const key = createHash("sha256").update(`${campaignId}:${ids.join(",")}`).digest("hex");
  const r = await send(emails, key);
  if (r.ok) return ids.map((_, i) => (r.data.data?.[i]?.id ? { id: r.data.data[i].id } : { error: "Resend did not confirm this email." }));
  if (!r.status || r.status === 429 || r.status >= 500) return "retry";
  if (emails.length === 1) return [{ error: r.error }];
  const mid = Math.ceil(emails.length / 2);
  const first = await deliver(send, campaignId, emails.slice(0, mid), ids.slice(0, mid));
  if (first === "retry") return "retry";
  const second = await deliver(send, campaignId, emails.slice(mid), ids.slice(mid));
  return second === "retry" ? "retry" : [...first, ...second];
}
