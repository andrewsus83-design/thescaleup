"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { adminLanding } from "@/lib/admin/landing";
import { Alert, Btn, Card, inputCls, labelCls } from "@/components/room/ui";
import { Logo } from "@/components/brand/logo";

export function MfaVerify({ factorId }: { factorId: string }) {
  const supabase = createSupabaseBrowserClient();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
    if (cErr || !ch) {
      setLoading(false);
      setError(cErr?.message ?? "Gagal membuat tantangan MFA.");
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: ch.id,
      code: code.trim(),
    });
    if (vErr) {
      setLoading(false);
      setError("Kode tidak valid. Coba lagi.");
      setCode("");
      return;
    }
    window.location.assign(adminLanding(window.location.hostname));
  }

  return (
    <div className="room-app fixed inset-0 z-10 overflow-y-auto bg-paper-100 font-text text-body text-ink-800 antialiased">
      <div className="mx-auto flex min-h-full w-full max-w-[30rem] flex-col justify-center px-5 py-12">
        <div className="mb-10 flex flex-col items-center text-center">
          <Logo variant="lockup" size={32} />
          <h1 className="mt-10 font-title text-balance text-h2 text-ink-800">Verifikasi Autentikator</h1>
          <p className="mt-3 text-pretty text-body text-ink-500">
            Masukkan kode 6 digit dari aplikasi autentikator Anda.
          </p>
        </div>

        <Card>
          {error && (
            <div className="mb-6">
              <Alert tone="bad" role="alert">{error}</Alert>
            </div>
          )}

          <form onSubmit={verify} className="space-y-6">
            <div>
              <label htmlFor="totp-code" className={labelCls}>
                Kode autentikator
              </label>
              <input
                id="totp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                minLength={6}
                pattern="[0-9]{6}"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className={inputCls}
                autoFocus
              />
            </div>

            <Btn type="submit" variant="primary" size="lg" className="w-full" disabled={loading || code.length !== 6}>
              {loading ? (
                <Loader2 className="size-5 animate-spin" aria-label="Memverifikasi" />
              ) : (
                <>
                  <ShieldCheck className="size-5" aria-hidden />
                  Masuk
                </>
              )}
            </Btn>
          </form>
        </Card>
      </div>
    </div>
  );
}
