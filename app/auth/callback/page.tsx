import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AuthCallbackClient from "./_client";

export const dynamic = "force-dynamic";

/**
 * Auth callback handles two Supabase redirect flows:
 *
 * 1. PKCE flow (?code=…)  — the browser-initiated signInWithOtp path stores a
 *    code verifier client-side; Supabase redirects here with ?code=…; we
 *    exchange it server-side and redirect to /admin/mfa.
 *
 * 2. Implicit flow (#access_token=…) — admin.generateLink() produces an OTP
 *    token link; after Supabase verifies it the redirect carries tokens in the
 *    URL hash, which is invisible to the server.  We render AuthCallbackClient
 *    which calls supabase.auth.getSession() in the browser; the browser client
 *    (detectSessionInUrl: true) automatically extracts the hash tokens and
 *    stores the session, then we navigate to /admin/mfa.
 */
export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; next?: string }>;
}) {
  const { code, next } = await searchParams;

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const safe = next?.startsWith("/") ? next : "/admin/mfa";
      redirect(safe);
    }
  }

  // No ?code= param — likely implicit flow with hash tokens.
  // AuthCallbackClient reads them client-side via getSession().
  return <AuthCallbackClient />;
}
