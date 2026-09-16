import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";

/**
 * Shared access-code gate for the admin backend (stand-in for email OTP).
 * Two codes with different privilege:
 *   - ADMIN_ACCESS_CODE (owner)  → full access (default 000000 via env).
 *   - MEMBER_ACCESS_CODE (member)→ limited access for newly-added users
 *     (create/read/update, no delete). TEMPORARY (111111) until OTP is fixed.
 * The cookie stores sha256(code); the role is recovered by matching the hash.
 */

const COOKIE = "sc_admin_access";

const OWNER_CODE = () => process.env.ADMIN_ACCESS_CODE || null;
// TEMP shared member code — remove once per-user OTP login is live.
const MEMBER_CODE = () => process.env.MEMBER_ACCESS_CODE || "111111";

export type AccessRole = "owner" | "member";

function tokenFor(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function accessCookieName() {
  return COOKIE;
}

/** The code fallback is shown whenever any access code is configured. */
export function isAccessEnabled() {
  return !!(OWNER_CODE() || MEMBER_CODE());
}

/** OPEN MODE — no login gate at all. Set ADMIN_OPEN=1 to enable. */
export function isOpenMode() {
  const v = process.env.ADMIN_OPEN;
  return v === "1" || v === "true";
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Which role a submitted code grants (or null if it matches neither). */
export function verifyCodeRole(code: string): AccessRole | null {
  const o = OWNER_CODE();
  const m = MEMBER_CODE();
  if (o && safeEqual(code, o)) return "owner";
  if (m && safeEqual(code, m)) return "member";
  return null;
}

/** Cookie value to store for the exact code that was entered. */
export function accessTokenForCode(code: string): string {
  return tokenFor(code);
}

/** The role carried by the current request's access cookie, or null. */
export async function adminAccessRole(): Promise<AccessRole | null> {
  const store = await cookies();
  const v = store.get(COOKIE)?.value;
  if (!v) return null;
  const o = OWNER_CODE();
  const m = MEMBER_CODE();
  if (o && safeEqual(v, tokenFor(o))) return "owner";
  if (m && safeEqual(v, tokenFor(m))) return "member";
  return null;
}

/* ------- backward-compatible helpers (owner code) ------- */
export function verifyCode(code: string): boolean {
  return verifyCodeRole(code) !== null;
}
export function accessTokenValue(): string | null {
  const o = OWNER_CODE();
  return o ? tokenFor(o) : null;
}
export async function hasAdminAccessCookie(): Promise<boolean> {
  return (await adminAccessRole()) !== null;
}
