"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Mail, KeyRound, ArrowLeft } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Logo } from "@/components/landing/logo";

export function AdminLoginForm() {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
      return;
    }
    setStep("otp");
    setInfo(`Kode 6 digit dikirim ke ${addr}. Cek email Anda.`);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    // Full navigation so the server picks up the fresh session cookies.
    window.location.assign("/admin");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-hero-glow px-6">
      <div className="pointer-events-none absolute inset-0 bg-grid-lines [mask-image:radial-gradient(55%_55%_at_50%_40%,#000,transparent)]" />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo />
          <h1 className="mt-6 font-display text-2xl font-extrabold text-mist">
            Admin Backend
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Masuk dengan email terdaftar via kode OTP.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-card/60 p-7 backdrop-blur-xl">
          {step === "email" ? (
            <form onSubmit={sendOtp} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  Email admin
                </span>
                <div className="flex items-center rounded-2xl border border-white/10 bg-obsidian/50 focus-within:border-coral/50 focus-within:ring-2 focus-within:ring-coral/20">
                  <Mail className="ml-4 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="andrewsus83@gmail.com"
                    className="w-full bg-transparent px-3 py-3.5 text-base text-mist placeholder:text-slate-600 focus:outline-none"
                  />
                </div>
              </label>
              <button
                type="submit"
                disabled={loading}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-coral-soft via-coral to-sunset font-display font-semibold text-white glow-coral transition-all hover:brightness-110 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Kirim kode OTP
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  Kode OTP
                </span>
                <div className="flex items-center rounded-2xl border border-white/10 bg-obsidian/50 focus-within:border-coral/50 focus-within:ring-2 focus-within:ring-coral/20">
                  <KeyRound className="ml-4 h-4 w-4 text-slate-500" />
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    className="w-full bg-transparent px-3 py-3.5 font-mono text-lg tracking-[0.3em] text-mist placeholder:text-slate-600 focus:outline-none"
                  />
                </div>
              </label>
              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-coral-soft via-coral to-sunset font-display font-semibold text-white glow-coral transition-all hover:brightness-110 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Masuk"
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                  setInfo(null);
                }}
                className="flex w-full items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Ganti email
              </button>
            </form>
          )}

          {info && <p className="mt-4 text-sm text-good">{info}</p>}
          {error && <p className="mt-4 text-sm text-bad">{error}</p>}
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Hanya email admin terdaftar yang dapat mengakses backend.
        </p>
      </div>
    </div>
  );
}
