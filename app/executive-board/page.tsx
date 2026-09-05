import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { PageHero } from "@/components/landing/page-hero";
import { ExecutiveBoard } from "@/components/landing/executive-board";
import { FinalCta } from "@/components/landing/final-cta";
import { Reveal } from "@/components/fx/reveal";

export const metadata: Metadata = {
  title: "Executive Board",
  description:
    "CMO, CBO, CTO, Creative, dan Red Team — kenali dewan AI C-level yang membedah bisnis Anda dari setiap sudut pandang eksekutif.",
};

export default function ExecutiveBoardPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          badge="Virtual Executive Board"
          title={
            <>
              Sebuah{" "}
              <span className="text-gradient-coral">dewan direksi AI</span>,
              bukan satu chatbot
            </>
          }
          subtitle="Lima spesialis bekerja bersama untuk setiap bisnis: masing-masing punya keahlian, sudut pandang, dan output yang berbeda — lalu saling menantang demi hasil yang realistis."
        />
        <ExecutiveBoard />
        <Reveal>
          <FinalCta />
        </Reveal>
      </main>
      <SiteFooter />
    </>
  );
}
