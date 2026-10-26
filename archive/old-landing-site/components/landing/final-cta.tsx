import { ArrowRight, Clock } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section className="relative py-24 sm:py-28">
      <Container>
        <div className="relative overflow-hidden rounded-[2.5rem] border border-coral/20 bg-gradient-to-br from-coral/15 via-surface to-obsidian px-6 py-16 text-center sm:px-16 sm:py-20">
          <div className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(60%_60%_at_50%_50%,#000,transparent)] opacity-40" />
          <div className="pointer-events-none absolute -left-10 -top-10 h-56 w-56 rounded-full bg-coral/25 blur-[100px] animate-float" />
          <div
            className="pointer-events-none absolute -bottom-10 -right-10 h-56 w-56 rounded-full bg-ember/20 blur-[100px] animate-float"
            style={{ animationDelay: "-3.5s" }}
          />

          <div className="relative mx-auto max-w-2xl">
            <span className="eyebrow text-coral">Something great is brewing</span>
            <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight text-mist sm:text-5xl">
              Berhenti menebak. Mulai{" "}
              <span className="text-gradient-coral">scale up</span> dengan data.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-slate-300">
              Isi 5 langkah singkat. Tim kami akan menghubungi Anda dengan
              temuan awal dan langkah pertama yang bisa langsung dijalankan.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button href="/mulai" size="lg" className="w-full sm:w-auto">
                Audit Bisnis Saya Sekarang
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
              </Button>
              <span className="inline-flex items-center gap-2 text-sm text-slate-400">
                <Clock className="h-4 w-4 text-coral" />
                Kurang dari 2 menit
              </span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
