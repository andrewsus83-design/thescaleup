"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { adminLanding } from "@/lib/admin/landing";
import { Alert, Btn, Card, inputCls, labelCls } from "@/components/room/ui";
import { Logo } from "@/components/brand/logo";

export function MfaEnroll() {
  const supabase = createSupabaseBrowserClient();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (cancelled) return;
      if (error || !data) {
        setError(error?.message ?? "Gagal memulai pendaftaran MFA.");
        setEnrolling(false);
        return;
      }
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setEnrolling(false);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
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
          <h1 className="mt-10 font-title text-balance text-h2 text-ink-800">Aktifkan Autentikator</h1>
          <p className="mt-3 text-pretty text-body text-ink-500">
            Scan QR code dengan Google Authenticator atau Authy, lalu masukkan kode 6 digit.
          </p>
        </div>

        <Card>
          {error && (
            <div className="mb-6">
              <Alert tone="bad" role="alert">{error}</Alert>
            </div>
          )}

          {enrolling ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-8 animate-spin text-ink-400" aria-label="Memuat QR code" />
            </div>
          ) : qrCode ? (
            <form onSubmit={verify} className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="QR code untuk autentikator" className="size-48 rounded-lg border border-stroke-200" />
                {secret && (
                  <details className="w-full text-center">
                    <summary className="cursor-pointer text-sm text-ink-400 hover:text-ink-600">
                      Tidak bisa scan? Masukkan kode manual
                    </summary>
                    <p className="mt-2 break-all rounded bg-paper-200 px-3 py-2 font-mono text-sm text-ink-700 select-all">
                      {secret}
                    </p>
                  </details>
                )}
              </div>

              <div>
                <label htmlFor="mfa-code" className={labelCls}>
                  Kode 6 digit dari aplikasi
                </label>
                <input
                  id="mfa-code"
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
                    Aktifkan MFA
                  </>
                )}
              </Btn>
            </form>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
