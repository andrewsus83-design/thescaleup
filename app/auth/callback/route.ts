import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Supabase Auth callback — exchanges the one-time code from a magic-link or
 * OTP email for a server-side session, then redirects to the admin area.
 * Listed as an allowed redirect URL in Supabase → Auth → URL Configuration.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Default to /admin/mfa — after magic-link login the session is AAL1 and
  // needs the TOTP second factor before entering the admin area.
  const next = searchParams.get("next") ?? "/admin/mfa";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const safe = next.startsWith("/") ? next : "/admin/mfa";
      return NextResponse.redirect(`${origin}${safe}`);
    }
  }

  // Code missing or exchange failed → back to login with error flag.
  return NextResponse.redirect(`${origin}/admin/login?e=otp`);
}
