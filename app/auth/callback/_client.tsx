"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Handles the implicit-flow case: Supabase redirects to /auth/callback with
 * tokens in the URL *hash* (#access_token=…). Hash fragments are invisible to
 * server route handlers, so we read them here in the browser.
 *
 * admin.generateLink() produces this flow — after Supabase verifies the OTP
 * it redirects to redirect_to#access_token=…&refresh_token=… rather than
 * redirect_to?code=… (PKCE).
 *
 * createBrowserClient has detectSessionInUrl: true by default, so getSession()
 * automatically picks up any tokens in the hash and stores them.
 */
export default function AuthCallbackClient() {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.assign("/admin/mfa");
      } else {
        window.location.assign("/admin/login?e=otp");
      }
    });
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-paper-100">
      <p className="text-ink-500 text-sm">Memuat...</p>
    </div>
  );
}
