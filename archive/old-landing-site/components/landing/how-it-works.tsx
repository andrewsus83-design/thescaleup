import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { steps } from "@/lib/site";

export function HowItWorks({ more }: { more?: boolean }) {
  return (
    <section id="cara-kerja" className="relative py-24 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Cara Kerja"
          title={
            <>
              Dari 8 input, jadi{" "}
              <span className="text-gradient-coral">strategi lengkap</span>
            </>
          }
          subtitle="Alur asynchronous yang mengumpulkan data, menganalisis, dan memverifikasi — semuanya berjalan otomatis di belakang layar."
        />

        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.n}
                className="group relative flex flex-col rounded-2xl border border-white/8 bg-card/40 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-coral/30"
              >
                {/* connector line */}
                {i < steps.length - 1 && (
                  <div className="absolute right-0 top-11 hidden h-px w-5 translate-x-full bg-gradient-to-r from-coral/40 to-transparent lg:block" />
                )}
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-coral/20 bg-coral/10 text-coral transition-transform group-hover:scale-105">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-3xl font-bold text-white/8">
                    {step.n}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-lg font-bold text-mist">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>

        {more && (
          <div className="mt-12 flex justify-center">
            <Button href="/cara-kerja" variant="secondary">
              Lihat detail cara kerja
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        )}
      </Container>
    </section>
  );
}
