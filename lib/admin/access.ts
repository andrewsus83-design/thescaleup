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

/* --- both codes require an email; the cookie is signed with (role, email) so
       the code alone is never enough and the session knows who logged in. --- */
function sigSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ADMIN_ACCESS_CODE || "scaleup-secret";
}
function emailSig(role: AccessRole, email: string): string {
  return crypto.createHmac("sha256", sigSecret()).update(`${role}:${email.toLowerCase()}`).digest("hex").slice(0, 32);
}
/** Cookie value for an (already-verified) email + role. */
export function sessionCookieValue(role: AccessRole, email: string): string {
  return `${role === "owner" ? "o" : "m"}:${email.toLowerCase()}:${emailSig(role, email)}`;
}
function readSessionCookie(v: string): { role: AccessRole; email: string } | null {
  const role: AccessRole | null = v.startsWith("o:") ? "owner" : v.startsWith("m:") ? "member" : null;
  if (!role) return null;
  const rest = v.slice(2);
  const idx = rest.lastIndexOf(":");
  if (idx < 0) return null;
  const email = rest.slice(0, idx);
  const sig = rest.slice(idx + 1);
  return safeEqual(sig, emailSig(role, email)) ? { role, email } : null;
}

export type AccessInfo = { role: AccessRole; email?: string } | null;

/** The access carried by the current request's cookie (role + email), or null. */
export async function adminAccess(): Promise<AccessInfo> {
  const store = await cookies();
  const v = store.get(COOKIE)?.value;
  if (!v) return null;
  const parsed = readSessionCookie(v);
  if (parsed) return parsed;
  // legacy: raw owner-code hash cookie (pre email-binding)
  const o = OWNER_CODE();
  if (o && safeEqual(v, tokenFor(o))) return { role: "owner" };
  return null;
}

/** Legacy role-only accessor (derived from adminAccess). */
export async function adminAccessRole(): Promise<AccessRole | null> {
  const a = await adminAccess();
  return a ? a.role : null;
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
