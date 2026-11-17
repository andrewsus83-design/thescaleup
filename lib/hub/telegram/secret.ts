import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { publicOrigin, unsubscribeKey } from "../email/secret";

// Telegram posts every message to the hub's address and puts a secret in a header, so the hub can tell it is really Telegram. The secret is
// worked out from the workspace encryption key and the brand's id, so nothing new is stored or has to be set up, each brand has its own,
// and it cannot be guessed from another brand's.

/** The secret for this brand's webhook (64 letters and digits), or null when the server has no encryption key. */
export function webhookSecret(brandId: string): string | null {
  const key = unsubscribeKey();
  return key ? createHmac("sha256", key).update(`telegram-webhook:${brandId}`).digest("hex") : null;
}

/** Whether the header Telegram sent is this brand's secret. */
export function verifySecret(brandId: string, header: string | null): boolean {
  const want = webhookSecret(brandId);
  if (!want || !header) return false;
  const a = Buffer.from(want);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The public address Telegram posts this brand's messages to. */
export const hookUrl = (brandId: string) => `${publicOrigin()}/api/telegram/${brandId}`;
