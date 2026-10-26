"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackClient() {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const queryParams = new URLSearchParams(window.location.search);
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const code = queryParams.get("code");

    async function exchange() {
      // Implicit flow: Supabase put tokens directly in the URL hash.
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        window.location.assign(error ? "/admin/login?e=otp" : "/admin/mfa");
        return;
      }

      // PKCE/admin code: try exchanging from the browser client (no verifier
      // needed for admin-generated codes).
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        window.location.assign(error ? "/admin/login?e=otp" : "/admin/mfa");
        return;
      }

      // No tokens in URL — check if the server already set a session cookie.
      const { data: { session } } = await supabase.auth.getSession();
      window.location.assign(session ? "/admin/mfa" : "/admin/login?e=otp");
    }

    exchange();
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-paper-100">
      <p className="text-ink-500 text-sm">Memuat...</p>
    </div>
  );
}
