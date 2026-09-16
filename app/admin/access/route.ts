import { NextResponse } from "next/server";
import { verifyCodeRole, accessCookieName, accessTokenForCode } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const code = String(form.get("code") ?? "");

  const role = verifyCodeRole(code);
  if (!role) {
    return NextResponse.redirect(new URL("/admin/login?e=1", request.url));
  }

  const res = NextResponse.redirect(new URL("/admin", request.url));
  res.cookies.set(accessCookieName(), accessTokenForCode(code), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
