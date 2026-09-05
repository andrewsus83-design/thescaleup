import { NextResponse } from "next/server";
import { verifyCode, accessCookieName, accessTokenValue } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const code = String(form.get("code") ?? "");

  if (!verifyCode(code)) {
    return NextResponse.redirect(new URL("/admin/login?e=1", request.url));
  }

  const token = accessTokenValue();
  const res = NextResponse.redirect(new URL("/admin", request.url));
  if (token) {
    res.cookies.set(accessCookieName(), token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }
  return res;
}
