import { Container } from "@/components/ui/container";
import { apiPartners } from "@/lib/site";

export function Marquee() {
  const row = [...apiPartners, ...apiPartners];
  return (
    <section className="border-y border-white/5 bg-surface/60 py-10">
      <Container>
        <p className="mb-6 text-center font-mono text-xs uppercase tracking-[0.22em] text-slate-500">
          Satu mesin, 8 sumber intelijen terpadu
        </p>
      </Container>
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
        <div className="flex w-max animate-marquee items-center gap-4">
          {row.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/8 bg-card/50 px-5 py-2.5"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-coral" />
              <span className="font-display text-sm font-semibold text-slate-300">
                {name}
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
