"use client";

// The admin login, in the brand v2 look (BRAND.md): light paper surface, Bricolage + Instrument Sans, one Orange action.
// Email OTP is the primary way in; the shared access code (email + code) stays as a fallback. After logging in, admins land
// on the Chat Room (lib/admin/landing.ts). The same page serves the report subdomain.

import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { adminLanding } from "@/lib/admin/landing";
import { Logo } from "@/components/brand/logo";
import { Alert, Btn, Card, inputCls, labelCls } from "@/components/room/ui";
import { cn } from "@/lib/utils";

export function AdminLoginForm({ codeFallback = false, initialError }: { codeFallback?: boolean; initialError?: string }) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  // only an OTP step that failed marks its field invalid (initialError comes from the access-code form)
  const [otpFailed, setOtpFailed] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOtpFailed(false);
    setInfo(null);
    const addr = email.trim().toLowerCase();
    if (!addr) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      setOtpFailed(true);
      return;
    }
    setStep("otp");
    setInfo(`Kode 6 digit dikirim ke ${addr}. Cek email Anda.`);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOtpFailed(false);
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      setOtpFailed(true);
      return;
    }
    // Full navigation so the server picks up the fresh session cookies. Admins land on the Chat Room.
    window.location.assign(adminLanding(window.location.hostname));
  }

  return (
    <div className="room-app fixed inset-0 z-10 overflow-y-auto bg-paper-100 font-text text-body text-ink-800 antialiased">
      <div className="mx-auto flex min-h-full w-full max-w-[30rem] flex-col justify-center px-5 py-12">
        <div className="mb-10 flex flex-col items-center text-center">
          <Logo variant="lockup" size={32} />
          <h1 className="mt-10 font-title text-balance text-h2 text-ink-800">Masuk ke Chat Room</h1>
          <p className="mt-3 text-pretty text-body text-ink-500">Masuk dengan email admin terdaftar lewat kode OTP.</p>
        </div>

        <Card>
          {(error || info) && (
            <div className="mb-6">
              {error ? (
                <Alert tone="bad" role="alert">
                  <span id="login-error">{error}</span>
                </Alert>
              ) : (
                <Alert tone="ok" role="status">
                  {info}
                </Alert>
              )}
            </div>
          )}

          {step === "email" ? (
            <form onSubmit={sendOtp} className="space-y-6">
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
                  aria-invalid={otpFailed}
                  aria-describedby={otpFailed ? "login-error" : undefined}
                />
              </div>
              <Btn type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="size-5 animate-spin" aria-label="Mengirim kode" />
                ) : (
                  <>
                    Kirim kode OTP
                    <ArrowRight className="size-5" aria-hidden />
                  </>
                )}
              </Btn>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-6">
              <div>
                <label htmlFor="admin-otp" className={labelCls}>
                  Kode OTP
                </label>
                <input
                  id="admin-otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className={cn(inputCls, "font-mono text-[20px] tracking-[0.3em]")}
                  aria-invalid={otpFailed}
                  aria-describedby={otpFailed ? "login-error" : undefined}
                />
              </div>
              <Btn type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="size-5 animate-spin" aria-label="Memeriksa kode" /> : "Masuk"}
              </Btn>
              <div className="flex justify-center">
                <Btn
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError(null);
                    setOtpFailed(false);
                    setInfo(null);
                  }}
                >
                  <ArrowLeft className="size-4" aria-hidden />
                  Ganti email
                </Btn>
              </div>
            </form>
          )}

          {codeFallback && (
            <div className="mt-8">
              <p className="label-caps mb-5 flex items-center gap-3 text-ink-500">
                <span className="h-px flex-1 bg-hairline" />
                atau email + kode akses
                <span className="h-px flex-1 bg-hairline" />
              </p>
              <form method="post" action="/admin/access" className="space-y-4">
                <div>
                  <label htmlFor="access-email" className={labelCls}>
                    Email terdaftar
                  </label>
                  <input
                    id="access-email"
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    defaultValue={email}
                    placeholder="nama@email.com"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="access-code" className={labelCls}>
                    Kode akses
                  </label>
                  <input id="access-code" type="password" name="code" required autoComplete="off" placeholder="Kode akses" className={inputCls} />
                </div>
                <Btn type="submit" variant="secondary" size="lg" className="w-full">
                  Masuk dengan kode
                </Btn>
              </form>
            </div>
          )}
        </Card>

        <p className="mt-6 text-center text-[13px] text-ink-500">Hanya email admin terdaftar yang dapat masuk.</p>
      </div>
    </div>
  );
}
