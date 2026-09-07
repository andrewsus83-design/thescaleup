import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { clientCookieName } from "@/lib/client/auth";

export const dynamic = "force-dynamic";

// Shareable magic link: /dashboard/enter?t=<access_token>
export async function GET(request: Request) {
  const t = new URL(request.url).searchParams.get("t") ?? "";
  if (t && isSupabaseAdminConfigured()) {
    const db = createSupabaseAdminClient();
    const { data } = await db
      .from("leads")
      .select("id")
      .eq("access_token", t)
      .maybeSingle();
    if (data) {
      const res = NextResponse.redirect(new URL("/dashboard", request.url));
      res.cookies.set(clientCookieName(), t, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 60,
      });
      return res;
    }
  }
  return NextResponse.redirect(new URL("/dashboard/login?e=1", request.url));
}
