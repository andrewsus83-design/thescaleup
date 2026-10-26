import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { PageHero } from "@/components/landing/page-hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Marquee } from "@/components/landing/marquee";
import { FinalCta } from "@/components/landing/final-cta";
import { Reveal } from "@/components/fx/reveal";

export const metadata: Metadata = {
  title: "Cara Kerja",
  description:
    "Dari 8 input sederhana menjadi strategi scale-up lengkap — alur asynchronous multi-API dan multi-agent ScaleUp, dijelaskan langkah demi langkah.",
};

export default function CaraKerjaPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          badge="Cara Kerja"
          title={
            <>
              Dari 8 input jadi{" "}
              <span className="text-gradient-coral">strategi lengkap</span>,
              dalam hitungan menit
            </>
          }
          subtitle="Anda hanya mengisi informasi dasar. Mesin kami yang mengumpulkan data, menganalisis dengan dewan AI, dan memverifikasi hasilnya sebelum sampai ke tangan Anda."
        />
        <HowItWorks />
        <Reveal>
          <Marquee />
        </Reveal>
        <Reveal>
          <FinalCta />
        </Reveal>
      </main>
      <SiteFooter />
    </>
  );
}
