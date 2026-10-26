import { Check, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { tiers } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Pricing() {
  return (
    <section id="harga" className="relative py-24 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Harga"
          title={
            <>
              Modal analisisnya recehan.{" "}
              <span className="text-gradient-coral">Dampaknya jutaan.</span>
            </>
          }
          subtitle="Mulai dari sekali audit, sampai kami yang eksekusikan seluruh strateginya. Pilih titik masuk yang paling pas."
        />

        <div className="mt-16 grid items-stretch gap-6 lg:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={cn(
                "relative flex flex-col rounded-3xl border p-7 transition-all duration-300",
                t.featured
                  ? "border-coral/40 bg-gradient-to-b from-coral/10 via-card/60 to-card/60 glow-coral lg:-my-3 lg:scale-[1.03]"
                  : "border-white/8 bg-card/40 hover:border-white/15",
              )}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-gradient-to-r from-coral to-sunset px-3.5 py-1 text-xs font-semibold text-white shadow-lg">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t.highlight}
                </span>
              )}

              <h3 className="font-display text-lg font-bold text-mist">
                {t.name}
              </h3>
              <p className="mt-1.5 min-h-10 text-sm text-slate-400">
                {t.tagline}
              </p>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span
                  className={cn(
                    "font-display text-4xl font-extrabold",
                    t.featured ? "text-gradient-coral" : "text-mist",
                  )}
                >
                  {t.price}
                </span>
                <span className="text-sm text-slate-500">/ {t.cadence}</span>
              </div>

              <div className="my-6 h-px bg-white/8" />

              <ul className="flex-1 space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        t.featured ? "text-coral" : "text-slate-500",
                      )}
                    />
                    <span
                      className={
                        f.endsWith(":") ? "font-semibold text-slate-200" : "text-slate-300"
                      }
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Button
                  href="/mulai"
                  variant={t.featured ? "primary" : "secondary"}
                  className="w-full"
                >
                  {t.cta}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          Semua paket sudah termasuk verifikasi Red Team &amp; garansi report
          yang bisa direvisi. Butuh volume / white-label?{" "}
          <a href="#footer" className="text-coral hover:underline">
            Hubungi kami
          </a>
          .
        </p>
      </Container>
    </section>
  );
}
