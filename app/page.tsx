import { SiteHeader } from "@/components/landing/site-header";
import { Hero } from "@/components/landing/hero";
import { Marquee } from "@/components/landing/marquee";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ExecutiveBoard } from "@/components/landing/executive-board";
import { SampleReport } from "@/components/landing/sample-report";
import { Pricing } from "@/components/landing/pricing";
import { BlogTeaser } from "@/components/landing/blog-teaser";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { SiteFooter } from "@/components/landing/site-footer";
import { Reveal } from "@/components/fx/reveal";
import { site, faqs } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: site.name,
      url: site.url,
      description: site.description,
      email: site.email,
    },
    {
      "@type": "WebSite",
      name: site.name,
      url: site.url,
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <main>
        <Hero />
        <Marquee />
        <Reveal>
          <HowItWorks more />
        </Reveal>
        <Reveal>
          <ExecutiveBoard more />
        </Reveal>
        <Reveal>
          <SampleReport />
        </Reveal>
        <Reveal>
          <Pricing />
        </Reveal>
        <Reveal>
          <BlogTeaser />
        </Reveal>
        <Reveal>
          <Faq more />
        </Reveal>
        <Reveal>
          <FinalCta />
        </Reveal>
      </main>
      <SiteFooter />
    </>
  );
}
