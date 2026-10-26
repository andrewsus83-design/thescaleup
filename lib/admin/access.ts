import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

/**
 * Shared access-code gate for the admin backend (stand-in for email OTP).
 * Two codes with different privilege:
 *   - ADMIN_ACCESS_CODE (owner)  → full access.
 *   - MEMBER_ACCESS_CODE (member)→ limited access for newly-added users.
 *
 * Cookie format (v2): role_prefix:email:sessionId:hmac(role:email:sessionId)
 * Each login creates a row in admin_sessions; deleting the row revokes the session.
 */

const COOKIE = "sc_admin_access";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const OWNER_CODE = () => process.env.ADMIN_ACCESS_CODE || null;
const MEMBER_CODE = () => process.env.MEMBER_ACCESS_CODE || "111111";

export type AccessRole = "owner" | "member";

export function accessCookieName() { return COOKIE; }

export function isAccessEnabled() { return !!(OWNER_CODE() || MEMBER_CODE()); }

export function isOpenMode() {
  const v = process.env.ADMIN_OPEN;
  return v === "1" || v === "true";
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function verifyCodeRole(code: string): AccessRole | null {
  const o = OWNER_CODE();
  const m = MEMBER_CODE();
  if (o && safeEqual(code, o)) return "owner";
  if (m && safeEqual(code, m)) return "member";
  return null;
}

/* ─── HMAC signing ───────────────────────────────────────────────────────── */

function sigSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ADMIN_ACCESS_CODE || "scaleup-secret";
}

function emailSig(role: AccessRole, email: string, sid: string): string {
  return crypto
    .createHmac("sha256", sigSecret())
    .update(`${role}:${email.toLowerCase()}:${sid}`)
    .digest("hex")
    .slice(0, 32);
}

/* ─── Session DB ─────────────────────────────────────────────────────────── */

/** Insert a session row; returns the new UUID (or null if DB not configured). */
export async function createAdminSession(role: AccessRole, email: string): Promise<string | null> {
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const db = createSupabaseAdminClient();
    const { data } = await db
      .from("admin_sessions")
      .insert({
        email: email.toLowerCase(),
        role,
        expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      })
      .select("id")
      .single();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

/** Delete all active sessions for an email (call when removing a user). */
export async function revokeAdminSessions(email: string): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  const e = email.toLowerCase();
  try {
    const db = createSupabaseAdminClient();
    await db.from("admin_sessions").delete().eq("email", e);
    // evict matching cache entries
    for (const k of _sessionCache.keys()) {
      if (k.endsWith(`:${e}`)) _sessionCache.delete(k);
    }
  } catch { /* non-fatal */ }
}

/* ─── In-process session cache ───────────────────────────────────────────── */
// Avoids a DB round-trip on every authenticated request; worst-case 5 min lag
// between revocation and enforcement (acceptable for this auth tier).

const _sessionCache = new Map<string, { valid: boolean; at: number }>();
const SESSION_CACHE_TTL = 5 * 60 * 1000;

async function verifySession(sid: string, email: string): Promise<boolean> {
  // "nosid" = session created before the DB was available; accept if DB is not configured.
  if (sid === "nosid") return !isSupabaseAdminConfigured();
  if (!isSupabaseAdminConfigured()) return true;

  const key = `${sid}:${email.toLowerCase()}`;
  const cached = _sessionCache.get(key);
  if (cached && Date.now() - cached.at < SESSION_CACHE_TTL) return cached.valid;

  try {
    const db = createSupabaseAdminClient();
    const { data } = await db
      .from("admin_sessions")
      .select("id")
      .eq("id", sid)
      .eq("email", email.toLowerCase())
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    const valid = !!data;
    if (_sessionCache.size > 2000) {
      const oldest = [..._sessionCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) _sessionCache.delete(oldest[0]);
    }
    _sessionCache.set(key, { valid, at: Date.now() });
    return valid;
  } catch {
    // Fail closed: if DB is unreachable, reject the session.
    return false;
  }
}

/* ─── Cookie value ───────────────────────────────────────────────────────── */

/** Build the cookie string for a new login session. */
export function sessionCookieValue(role: AccessRole, email: string, sessionId: string | null): string {
  const sid = sessionId ?? "nosid";
  return `${role === "owner" ? "o" : "m"}:${email.toLowerCase()}:${sid}:${emailSig(role, email, sid)}`;
}

function readSessionCookie(v: string): { role: AccessRole; email: string; sessionId: string } | null {
  const role: AccessRole | null = v.startsWith("o:") ? "owner" : v.startsWith("m:") ? "member" : null;
  if (!role) return null;
  const rest = v.slice(2);
  // format: email:sessionId:sig — split from the right to handle emails with colons
  const lastColon = rest.lastIndexOf(":");
  if (lastColon < 0) return null;
  const sig = rest.slice(lastColon + 1);
  const body = rest.slice(0, lastColon);
  const sidColon = body.lastIndexOf(":");
  if (sidColon < 0) return null;
  const sessionId = body.slice(sidColon + 1);
  const email = body.slice(0, sidColon);
  if (!email) return null;
  return safeEqual(sig, emailSig(role, email, sessionId)) ? { role, email, sessionId } : null;
}

/* ─── Public accessors ───────────────────────────────────────────────────── */

export type AccessInfo = { role: AccessRole; email?: string } | null;

export async function adminAccess(): Promise<AccessInfo> {
  const store = await cookies();
  const v = store.get(COOKIE)?.value;
  if (!v) return null;
  const parsed = readSessionCookie(v);
  if (!parsed) return null;
  const valid = await verifySession(parsed.sessionId, parsed.email);
  if (!valid) return null;
  return { role: parsed.role, email: parsed.email };
}

export async function adminAccessRole(): Promise<AccessRole | null> {
  const a = await adminAccess();
  return a ? a.role : null;
}

/* ─── Backward-compat helpers ────────────────────────────────────────────── */
function tokenFor(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}
export function accessTokenForCode(code: string): string { return tokenFor(code); }
export function accessTokenValue(): string | null {
  const o = OWNER_CODE();
  return o ? tokenFor(o) : null;
}
export async function hasAdminAccessCookie(): Promise<boolean> {
  return (await adminAccessRole()) !== null;
}
export function verifyCode(code: string): boolean { return verifyCodeRole(code) !== null; }
