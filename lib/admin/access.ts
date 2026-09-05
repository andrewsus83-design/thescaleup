import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";

/**
 * Lightweight shared-access-code gate for the admin backend — a stand-in for
 * email OTP when Supabase's default mailer isn't delivering. Still a secret
 * (so customer PII / API keys aren't fully public), just no email dependency.
 * Set ADMIN_ACCESS_CODE to enable; unset it to fall back to OTP.
 */

const COOKIE = "sc_admin_access";

function tokenFor(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function accessCookieName() {
  return COOKIE;
}

export function isAccessEnabled() {
  return !!process.env.ADMIN_ACCESS_CODE;
}

/** OPEN MODE — no login gate at all. Set ADMIN_OPEN=1 to enable; unset to lock. */
export function isOpenMode() {
  const v = process.env.ADMIN_OPEN;
  return v === "1" || v === "true";
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Verify a submitted code against the configured one (constant-time). */
export function verifyCode(code: string): boolean {
  const expected = process.env.ADMIN_ACCESS_CODE;
  if (!expected) return false;
  return safeEqual(code, expected);
}

/** The cookie value to set once a code is accepted. */
export function accessTokenValue(): string | null {
  const code = process.env.ADMIN_ACCESS_CODE;
  return code ? tokenFor(code) : null;
}

/** Whether the current request carries a valid access cookie. */
export async function hasAdminAccessCookie(): Promise<boolean> {
  const code = process.env.ADMIN_ACCESS_CODE;
  if (!code) return false;
  const store = await cookies();
  const v = store.get(COOKIE)?.value;
  if (!v) return false;
  return safeEqual(v, tokenFor(code));
}
