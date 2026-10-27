import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM encryption for API key values stored in app_settings.
// Set ROOM_ENCRYPTION_KEY to a 64-char hex string (32 random bytes).
// If the key is absent, values are stored/returned as plaintext (dev fallback).

const PREFIX = "enc:v1:";

function getKey(): Buffer | null {
  const hex = process.env.ROOM_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) return null;
  return Buffer.from(hex, "hex");
}

export function encryptValue(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${ciphertext.toString("hex")}:${tag.toString("hex")}`;
}

export function decryptValue(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const key = getKey();
  if (!key) return stored;
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) return stored;
  const [ivHex, ciphertextHex, tagHex] = parts;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return decipher.update(Buffer.from(ciphertextHex, "hex")).toString("utf8") + decipher.final("utf8");
  } catch {
    return stored;
  }
}
