import { createHash, createHmac, timingSafeEqual } from "node:crypto";

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

/** Secrets pasted into an env var often carry a newline or wrapping quotes; neither is part of the secret. */
export function cleanSecret(raw: string): string {
  return raw.trim().replace(/^(["'])(.*)\1$/, "$2").trim();
}

/**
 * Why a delivery was refused, for the server log only. It never contains the secret: `fp` is the first 8 hex characters of
 * its SHA-256, so it can be compared with `printf %s "<secret>" | shasum -a 256 | cut -c1-8` without exposing the value.
 */
export function svixFailure(opts: { id: string | null; timestamp: string | null; signature: string | null; secret: string; nowMs?: number; toleranceSec?: number }): Record<string, unknown> {
  const { id, timestamp, signature, secret } = opts;
  const info: Record<string, unknown> = {
    hasId: !!id,
    hasTimestamp: !!timestamp,
    hasSignature: !!signature,
    secretPrefixOk: secret.startsWith("whsec_"),
    secretChars: secret.length,
    keyBytes: Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64").length,
    fp: createHash("sha256").update(secret).digest("hex").slice(0, 8),
  };
  if (!id || !timestamp || !signature) return { ...info, reason: "missing-header" };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ...info, reason: "bad-timestamp" };
  const skew = Math.round((opts.nowMs ?? Date.now()) / 1000 - ts);
  if (Math.abs(skew) > (opts.toleranceSec ?? 300)) return { ...info, reason: "stale-timestamp", skewSec: skew };
  const versions = signature.split(" ").map((part) => part.split(",")[0]);
  if (!versions.includes("v1")) return { ...info, reason: "no-v1-signature", versions };
  return { ...info, reason: "signature-mismatch", signatures: versions.length };
}
