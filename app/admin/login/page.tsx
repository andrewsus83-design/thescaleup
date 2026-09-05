import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound, ArrowRight } from "lucide-react";
import { getAdminUser } from "@/lib/admin/auth";
import { isAccessEnabled } from "@/lib/admin/access";
import { AdminLoginForm } from "@/components/admin/login-form";
import { Logo } from "@/components/landing/logo";

export const metadata: Metadata = {
  title: "Admin Login",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const user = await getAdminUser();
  if (user) redirect("/admin");

  // If OTP email isn't set up, use the shared access-code gate.
  if (!isAccessEnabled()) {
    return <AdminLoginForm />;
  }

  const { e } = await searchParams;

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
            Masuk dengan kode akses.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-card/60 p-7 backdrop-blur-xl">
          <form method="post" action="/admin/access" className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">
                Kode akses
              </span>
              <div className="flex items-center rounded-2xl border border-white/10 bg-obsidian/50 focus-within:border-coral/50 focus-within:ring-2 focus-within:ring-coral/20">
                <KeyRound className="ml-4 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  name="code"
                  required
                  autoFocus
                  autoComplete="off"
                  placeholder="••••••••"
                  className="w-full bg-transparent px-3 py-3.5 text-base text-mist placeholder:text-slate-600 focus:outline-none"
                />
              </div>
            </label>
            <button
              type="submit"
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-coral-soft via-coral to-sunset font-display font-semibold text-white glow-coral transition-all hover:brightness-110"
            >
              Masuk
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>

          {e && (
            <p className="mt-4 text-sm text-bad">Kode akses salah. Coba lagi.</p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Akses backend ScaleUp — hanya untuk tim internal.
        </p>
      </div>
    </div>
  );
}
