"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackClient() {
  const [status, setStatus] = useState("Memeriksa...");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(window.location.search);

    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const code = queryParams.get("code");
    const errorParam = queryParams.get("error") || hashParams.get("error");

    // Show debug info
    setStatus(
      `hash keys: ${hash ? [...hashParams.keys()].join(",") || "(empty hash)" : "(no hash)"}` +
      ` | query: code=${code ? "yes" : "no"} error=${errorParam ?? "no"}`
    );

    async function exchange() {
      // Case 1: explicit hash tokens (implicit flow)
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) {
          window.location.assign("/admin/mfa");
          return;
        }
        setStatus("setSession error: " + error.message);
        setTimeout(() => window.location.assign("/admin/login?e=otp"), 3000);
        return;
      }

      // Case 2: code in query string (PKCE or admin-generated code)
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          window.location.assign("/admin/mfa");
          return;
        }
        setStatus("exchangeCode error: " + error.message);
        setTimeout(() => window.location.assign("/admin/login?e=otp"), 3000);
        return;
      }

      // Case 3: maybe getSession already has it (server set session cookie)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        window.location.assign("/admin/mfa");
        return;
      }

      setStatus("Tidak ada token ditemukan di URL.");
      setTimeout(() => window.location.assign("/admin/login?e=otp"), 3000);
    }

    exchange();
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-paper-100 gap-4">
      <p className="text-ink-500 text-sm">Memuat...</p>
      <p className="text-xs text-ink-400 font-mono max-w-sm text-center break-all">{status}</p>
    </div>
  );
}
