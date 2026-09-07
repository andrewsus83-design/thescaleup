import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { clientCookieName } from "@/lib/client/auth";

export const dynamic = "force-dynamic";

async function grant(request: Request, token: string) {
  if (!token || !isSupabaseAdminConfigured()) return null;
  const db = createSupabaseAdminClient();
  const { data } = await db
    .from("leads")
    .select("id")
    .eq("access_token", token)
    .maybeSingle();
  if (!data) return null;
  const res = NextResponse.redirect(new URL("/dashboard", request.url));
  res.cookies.set(clientCookieName(), token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
  return res;
}

export async function POST(request: Request) {
  const form = await request.formData();
  const code = String(form.get("code") ?? "").trim();
  const res = await grant(request, code);
  return res ?? NextResponse.redirect(new URL("/dashboard/login?e=1", request.url));
}
