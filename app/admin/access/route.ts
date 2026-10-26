import { NextResponse } from "next/server";
import { verifyCodeRole, accessCookieName, sessionCookieValue, createAdminSession } from "@/lib/admin/access";
import { isAdminEmail } from "@/lib/admin/config";
import { isRegisteredAdmin } from "@/lib/admin/auth";
import { adminLanding } from "@/lib/admin/landing";

export const dynamic = "force-dynamic";

// Per-IP sliding-window rate limiter: 5 attempts per 15 minutes.
// Module-level (per serverless instance) — provides meaningful brute-force protection
// without requiring external state; a distributed Redis limiter is the next step.
const _attempts = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 5;
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  if (_attempts.size > 2000) {
    for (const [k, v] of _attempts) if (now > v.resetAt) _attempts.delete(k);
  }
  const e = _attempts.get(ip);
  if (!e || now > e.resetAt) { _attempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS }); return true; }
  if (e.count >= RATE_MAX) return false;
  e.count++;
  return true;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return new NextResponse("Too many requests", { status: 429, headers: { "Retry-After": "900" } });
  }

  const form = await request.formData();
  const code = String(form.get("code") ?? "");
  const email = String(form.get("email") ?? "").trim().toLowerCase();

  const role = verifyCodeRole(code);
  const fail = (e: number) => NextResponse.redirect(new URL(`/admin/login?e=${e}`, request.url));
  if (!role || !email) return fail(1); // missing email or wrong code

  // owner code → email must be an env owner; member code → email must be registered
  const allowed = role === "owner" ? isAdminEmail(email) : await isRegisteredAdmin(email);
  if (!allowed) return fail(2); // email not registered for this code

  const sessionId = await createAdminSession(role, email);
  const res = NextResponse.redirect(new URL(adminLanding(request.headers.get("host")), request.url));
  res.cookies.set(accessCookieName(), sessionCookieValue(role, email, sessionId), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
