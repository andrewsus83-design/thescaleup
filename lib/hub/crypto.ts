import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM. The "aad" ties a ciphertext to the row it belongs to (scope + provider), so a stored value cannot be
// copied onto another brand or provider and still decrypt.

/** A 32-byte key from base64, or null when missing or the wrong length. */
export function parseKey(b64: string | undefined | null): Buffer | null {
  if (!b64) return null;
  const k = Buffer.from(b64.trim(), "base64");
  return k.length === 32 ? k : null;
}

export function encrypt(plain: string, key: Buffer, aad: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(aad));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([nonce, body, cipher.getAuthTag()]).toString("base64");
}

/** Throws when the key, the aad or the data is wrong. */
export function decrypt(payload: string, key: Buffer, aad: string): string {
  const raw = Buffer.from(payload, "base64");
  if (raw.length < 12 + 16) throw new Error("ciphertext too short");
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(raw.subarray(raw.length - 16));
  return Buffer.concat([decipher.update(raw.subarray(12, raw.length - 16)), decipher.final()]).toString("utf8");
}

export function last4(value: string): string {
  return value.length <= 8 ? "" : value.slice(-4);
}
