import Image from "next/image";
import { ArrowRight, Sparkles, TrendingUp, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScoreRing } from "@/components/ui/score-ring";
import { pillars, stats, trustPoints } from "@/lib/site";
import { rupiah } from "@/lib/utils";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-obsidian pb-20 pt-28 sm:pt-36">
      {/* generated hero backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <Image
          src="/hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-right opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-obsidian/85 via-obsidian/45 to-obsidian" />
        <div className="absolute inset-0 bg-gradient-to-r from-obsidian/70 via-transparent to-obsidian/20" />
      </div>
      {/* grid + orbs */}
      <div className="pointer-events-none absolute inset-0 bg-grid-lines opacity-50 [mask-image:radial-gradient(65%_55%_at_50%_35%,#000,transparent)]" />
      <div
        className="pointer-events-none absolute -right-20 top-40 h-72 w-72 rounded-full bg-ember/10 blur-[120px] animate-float"
        style={{ animationDelay: "-3s" }}
      />

      <Container className="relative">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="animate-fade-up">
            <Badge>
              <Sparkles className="h-3.5 w-3.5" />
              Ditenagai 8 API &amp; 5 Agent AI C-Level
            </Badge>
          </div>

          <h1
            className="animate-fade-up mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-mist sm:text-5xl md:text-6xl"
            style={{ animationDelay: "0.06s" }}
          >
            Temukan kebocoran omzet Anda,
            <br className="hidden sm:block" /> lalu{" "}
            <span className="text-gradient-coral">scale up</span> dengan
            roadmap yang jelas.
          </h1>

          <p
            className="animate-fade-up mt-6 max-w-2xl text-lg leading-relaxed text-slate-400"
            style={{ animationDelay: "0.12s" }}
          >
            Masukkan 8 info bisnis Anda. Dewan AI kami — CMO, CBO, CTO —
            membedah website, sosial media, dan posisi Anda di AI Search, lalu
            menyerahkan skor kesehatan bisnis, kebocoran omzet, dan aset
            done-for-you yang siap dieksekusi.
          </p>

          <div
            className="animate-fade-up mt-9 flex w-full flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: "0.18s" }}
          >
            <Button href="/mulai" size="lg" className="w-full sm:w-auto">
              Audit Bisnis Saya
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button
              href="#report"
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto"
            >
              Lihat contoh report
            </Button>
          </div>

          <ul
            className="animate-fade-up mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500"
            style={{ animationDelay: "0.24s" }}
          >
            {trustPoints.map((t) => (
              <li key={t} className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-good" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Command Center preview */}
        <div
          className="animate-fade-up relative mx-auto mt-16 max-w-4xl"
          style={{ animationDelay: "0.3s" }}
        >
          <div className="absolute -inset-x-10 -top-8 bottom-0 rounded-[2rem] bg-coral/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-card/70 shadow-2xl backdrop-blur-xl">
            {/* window chrome */}
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-bad/70" />
                <span className="h-3 w-3 rounded-full bg-warn/70" />
                <span className="h-3 w-3 rounded-full bg-good/70" />
                <span className="ml-3 font-mono text-xs tracking-widest text-slate-500">
                  SCALEUP · COMMAND CENTER
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-good/30 bg-good/10 px-2.5 py-1 font-mono text-[0.62rem] tracking-wider text-good">
                <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-good" />
                READY
              </span>
            </div>

            <div className="grid gap-6 p-6 md:grid-cols-5 md:p-7">
              {/* pillar rings */}
              <div className="md:col-span-3">
                <p className="eyebrow mb-4 text-slate-500">Skor 4 Pilar Bisnis</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {pillars.map((p) => (
                    <div
                      key={p.key}
                      className="flex flex-col items-center gap-2 rounded-2xl border border-white/5 bg-obsidian/50 p-3"
                    >
                      <ScoreRing value={p.score} size={84} stroke={7} />
                      <span className="text-center text-[0.72rem] font-medium leading-tight text-slate-400">
                        {p.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* revenue booster */}
              <div className="md:col-span-2">
                <p className="eyebrow mb-4 text-slate-500">
                  Revenue Booster
                </p>
                <div className="relative overflow-hidden rounded-2xl border border-coral/20 bg-gradient-to-br from-coral/15 via-card to-card p-5">
                  <div className="flex items-center gap-2 text-slate-400">
                    <TrendingUp className="h-4 w-4 text-coral" />
                    <span className="text-xs">Proyeksi setelah scale-up</span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-mono text-sm text-slate-500 line-through">
                      {rupiah(75_000_000)}
                    </span>
                  </div>
                  <div className="font-display text-3xl font-extrabold text-gradient-coral">
                    {rupiah(180_000_000)}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">per bulan</p>
                  <div className="mt-4 rounded-xl border border-white/5 bg-obsidian/60 px-3 py-2.5">
                    <p className="font-mono text-[0.68rem] leading-relaxed text-coral-soft">
                      +{rupiah(105_000_000)} · WA funnel + CRO + GEO
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* stats */}
        <div
          className="animate-fade-up mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/5 bg-white/5 sm:grid-cols-4"
          style={{ animationDelay: "0.36s" }}
        >
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-obsidian/80 px-4 py-6 text-center"
            >
              <div className="font-display text-2xl font-extrabold text-mist sm:text-3xl">
                {s.value}
              </div>
              <div className="mt-1 text-xs text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
