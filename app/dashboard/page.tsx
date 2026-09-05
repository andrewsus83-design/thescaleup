import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Dashboard Klien",
  robots: { index: false, follow: false },
};

export default function DashboardPlaceholder() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-hero-glow px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(50%_50%_at_50%_45%,#000,transparent)] opacity-40" />
      <div className="relative z-10 flex max-w-lg flex-col items-center">
        <Logo />
        <span className="mt-10 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-coral/25 bg-coral/10 text-coral">
          <LayoutDashboard className="h-7 w-7" />
        </span>
        <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-mist sm:text-4xl">
          Client Dashboard segera hadir
        </h1>
        <p className="mt-4 text-slate-400">
          Di sinilah Anda akan memantau skor 4 pilar, roadmap, kalender konten,
          dan progress scale-up Anda secara real-time. Sedang kami siapkan.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Button href="/mulai">Mulai Audit Sekarang</Button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-coral"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
