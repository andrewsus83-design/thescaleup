import { NextResponse } from "next/server";
import { verifyCodeRole, accessCookieName, sessionCookieValue } from "@/lib/admin/access";
import { isAdminEmail } from "@/lib/admin/config";
import { isRegisteredAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const code = String(form.get("code") ?? "");
  const email = String(form.get("email") ?? "").trim().toLowerCase();

  const role = verifyCodeRole(code);
  const fail = (e: number) => NextResponse.redirect(new URL(`/admin/login?e=${e}`, request.url));
  if (!role || !email) return fail(1); // missing email or wrong code

  // owner code → email must be an env owner; member code → email must be registered
  const allowed = role === "owner" ? isAdminEmail(email) : await isRegisteredAdmin(email);
  if (!allowed) return fail(2); // email not registered for this code

  const res = NextResponse.redirect(new URL("/admin", request.url));
  res.cookies.set(accessCookieName(), sessionCookieValue(role, email), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
