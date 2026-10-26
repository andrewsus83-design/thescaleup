"use client";

// The admin login, in the brand v2 look (BRAND.md): light paper surface, Bricolage + Instrument Sans, one Orange action.
// Magic-link is the primary way in: user enters email, we generate the link server-side via Supabase admin +
// send it via Resend HTTP API. After clicking the link → /auth/callback → /admin/mfa (TOTP second factor).

import { useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { Loader2 } from "lucide-react";
import { sendMagicLink } from "@/lib/admin/send-magic-link";
import { Logo } from "@/components/brand/logo";
import { Alert, Btn, Card, inputCls, labelCls } from "@/components/room/ui";

export function AdminLoginForm({ codeFallback = false, initialError }: { codeFallback?: boolean; initialError?: string }) {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const addr = email.trim().toLowerCase();
    if (!addr) return;
    setLoading(true);
    const result = await sendMagicLink(addr);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Gagal mengirim email. Coba lagi.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="room-app fixed inset-0 z-10 overflow-y-auto bg-paper-100 font-text text-body text-ink-800 antialiased">
      <div className="mx-auto flex min-h-full w-full max-w-[30rem] flex-col justify-center px-5 py-12">
        <div className="mb-10 flex flex-col items-center text-center">
          <Logo variant="lockup" size={32} />
          <h1 className="mt-10 font-title text-balance text-h2 text-ink-800">Masuk ke Chat Room</h1>
          <p className="mt-3 text-pretty text-body text-ink-500">
            {sent ? "Cek email Anda dan klik link masuk." : "Masukkan email admin terdaftar untuk mendapat link masuk."}
          </p>
        </div>

        <Card>
          {error && (
            <div className="mb-6">
              <Alert tone="bad" role="alert">{error}</Alert>
            </div>
          )}

          {sent ? (
            <div className="flex flex-col items-center gap-6 py-4 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-[#fff7ed]">
                <Mail className="size-8 text-orange-500" aria-hidden />
              </div>
              <div>
                <p className="font-semibold text-ink-800">Link dikirim ke</p>
                <p className="mt-1 text-ink-500">{email}</p>
              </div>
              <p className="text-sm text-ink-400">
                Klik link di email untuk melanjutkan. Link berlaku 1 jam.
              </p>
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => { setSent(false); setEmail(""); setError(null); }}
              >
                Ganti email
              </Btn>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="admin-email" className={labelCls}>
                  Email admin
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className={inputCls}
                />
              </div>
              <Btn type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="size-5 animate-spin" aria-label="Mengirim link" />
                ) : (
                  <>
                    Kirim link masuk
                    <ArrowRight className="size-5" aria-hidden />
                  </>
                )}
              </Btn>
            </form>
          )}
        </Card>

        <p className="mt-6 text-center text-[13px] text-ink-500">Hanya email admin terdaftar yang dapat masuk.</p>
      </div>
    </div>
  );
}
