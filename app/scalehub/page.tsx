import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { ArticleGrid } from "@/components/scalehub/article-grid";
import { getAllArticles } from "@/lib/scalehub/data";
import { site } from "@/lib/site";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "ScaleHub — Wawasan & Cerita Pertumbuhan",
  description:
    "Pusat konten ScaleUp: strategi GEO, CRO, otomatisasi, dan cerita scale-up dari ScaleUp maupun brand klien kami.",
  alternates: { canonical: "/scalehub" },
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: "id_ID",
    title: "ScaleHub — Wawasan & Cerita Pertumbuhan",
    description:
      "Strategi growth, GEO, konversi & otomatisasi dari ScaleUp dan brand klien.",
    url: `${site.url}/scalehub`,
  },
};

export default async function ScaleHubIndex() {
  const articles = await getAllArticles();

  return (
    <>
      <SiteHeader />
      <main className="pt-28 sm:pt-32">
        <section className="bg-hero-glow pb-12">
          <Container className="text-center">
            <Badge>ScaleHub</Badge>
            <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-extrabold tracking-tight text-mist sm:text-5xl">
              Wawasan & cerita untuk bisnis yang{" "}
              <span className="text-gradient-coral">mau naik kelas</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
              Satu tempat untuk semua artikel — strategi dari tim ScaleUp dan
              cerita pertumbuhan nyata dari brand klien kami.
            </p>
          </Container>
        </section>

        <section className="pb-24">
          <Container>
            <ArticleGrid articles={articles} />
          </Container>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
