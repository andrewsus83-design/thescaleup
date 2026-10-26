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
  const next = searchParams.get("next") ?? "/admin/login";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // After OTP login the session is AAL1; redirect to MFA step.
      // The MFA page will redirect to the admin area once AAL2 is reached.
      const dest = next.startsWith("/") ? next : "/admin/mfa";
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  // Code missing or exchange failed → back to login with error flag.
  return NextResponse.redirect(`${origin}/admin/login?e=otp`);
}
