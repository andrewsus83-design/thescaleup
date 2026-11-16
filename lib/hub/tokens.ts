import { createHash, randomBytes } from "node:crypto";

/** A random invite token (sent once, never stored) and its SHA-256 hash (stored). */
export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cheap shape check before hitting the database. */
export function looksLikeToken(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{43}$/.test(v);
}
