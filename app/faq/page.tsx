import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { PageHero } from "@/components/landing/page-hero";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { Reveal } from "@/components/fx/reveal";
import { faqs } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Pertanyaan yang sering muncul soal audit ScaleUp — waktu proses, data yang dibutuhkan, akurasi, dan cara eksekusi.",
};

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <main>
        <PageHero
          badge="FAQ"
          title={
            <>
              Punya pertanyaan?{" "}
              <span className="text-gradient-coral">Kami jawab.</span>
            </>
          }
          subtitle="Hal-hal yang paling sering ditanyakan sebelum menjalankan audit pertama."
        />
        <Faq />
        <Reveal>
          <FinalCta />
        </Reveal>
      </main>
      <SiteFooter />
    </>
  );
}
