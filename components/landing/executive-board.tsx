import { Check, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { board, redTeam } from "@/lib/site";

export function ExecutiveBoard({ more }: { more?: boolean }) {
  const RedIcon = redTeam.icon;
  return (
    <section
      id="board"
      className="relative overflow-hidden border-y border-white/5 bg-surface/50 py-24 sm:py-28"
    >
      <div className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(50%_50%_at_50%_50%,#000,transparent)] opacity-40" />
      <Container className="relative">
        <SectionHeading
          eyebrow="Virtual Executive Board"
          title={
            <>
              Bukan satu AI. Sebuah{" "}
              <span className="text-gradient-coral">dewan direksi</span> yang
              berdebat demi bisnis Anda.
            </>
          }
          subtitle="Tiap agent adalah spesialis C-level dengan sudut pandang berbeda. Mereka bekerja paralel, lalu satu Red Team menantang hasilnya sebelum sampai ke tangan Anda."
        />

        <div className="mt-16 grid gap-5 sm:grid-cols-2">
          {board.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.role}
                className="group relative overflow-hidden rounded-3xl border border-white/8 bg-card/50 p-7 transition-all duration-300 hover:border-coral/30"
              >
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-coral/8 blur-2xl transition-opacity duration-300 group-hover:bg-coral/15" />
                <div className="relative flex items-start gap-4">
                  <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-coral/20 bg-gradient-to-br from-coral/20 to-transparent text-coral">
                    <Icon className="h-6 w-6" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold tracking-widest text-coral">
                        {m.role}
                      </span>
                    </div>
                    <h3 className="mt-0.5 font-display text-xl font-bold text-mist">
                      {m.title}
                    </h3>
                  </div>
                </div>
                <p className="relative mt-4 text-sm leading-relaxed text-slate-400">
                  {m.summary}
                </p>
                <ul className="relative mt-5 space-y-2.5 border-t border-white/5 pt-5">
                  {m.delivers.map((d) => (
                    <li key={d} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Red team band */}
        <div className="relative mt-5 overflow-hidden rounded-3xl border border-good/20 bg-gradient-to-r from-good/10 via-card/60 to-card/60 p-7 sm:flex sm:items-center sm:gap-6">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-good/30 bg-good/10 text-good">
            <RedIcon className="h-6 w-6" />
          </span>
          <div className="mt-4 sm:mt-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold tracking-widest text-good">
                RED TEAM
              </span>
            </div>
            <h3 className="mt-0.5 font-display text-lg font-bold text-mist">
              {redTeam.role}
            </h3>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-400">
              {redTeam.summary}
            </p>
          </div>
        </div>

        {more && (
          <div className="mt-12 flex justify-center">
            <Button href="/executive-board" variant="secondary">
              Kenali executive board lengkap
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        )}
      </Container>
    </section>
  );
}
