"use client";

import { useState } from "react";
import { Plus, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { faqs } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Faq({ more }: { more?: boolean }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="relative py-24 sm:py-28">
      <Container className="max-w-3xl">
        <SectionHeading
          eyebrow="FAQ"
          title="Pertanyaan yang sering muncul"
        />

        <div className="mt-12 space-y-3">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div
                key={i}
                className={cn(
                  "overflow-hidden rounded-2xl border transition-colors",
                  isOpen
                    ? "border-coral/30 bg-card/60"
                    : "border-white/8 bg-card/30 hover:border-white/15",
                )}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4.5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-display text-base font-semibold text-mist sm:text-lg">
                    {f.q}
                  </span>
                  <Plus
                    className={cn(
                      "h-5 w-5 shrink-0 text-coral transition-transform duration-300",
                      isOpen && "rotate-45",
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-all duration-300 ease-out",
                    isOpen
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm leading-relaxed text-slate-400">
                      {f.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {more && (
          <div className="mt-10 flex justify-center">
            <Button href="/faq" variant="secondary">
              Buka halaman FAQ
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        )}
      </Container>
    </section>
  );
}
