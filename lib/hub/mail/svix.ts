import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Checks a Resend webhook (they are signed with Svix). The signed text is `${id}.${timestamp}.${body}` with the raw body,
 * the key is the part of the `whsec_` secret after the prefix (base64), and the header may hold several `v1,<signature>`
 * values while a secret is being rotated: any one matching is enough. Deliveries older than five minutes are refused.
 */
export function verifySvix(opts: { id: string | null; timestamp: string | null; signature: string | null; body: string; secret: string; nowMs?: number; toleranceSec?: number }): boolean {
  const { id, timestamp, signature, body, secret } = opts;
  if (!id || !timestamp || !signature || !secret) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = (opts.nowMs ?? Date.now()) / 1000;
  if (Math.abs(now - ts) > (opts.toleranceSec ?? 300)) return false;
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  if (key.length === 0) return false;
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  for (const part of signature.split(" ")) {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) continue;
    const given = Buffer.from(value, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) return true;
  }
  return false;
}
