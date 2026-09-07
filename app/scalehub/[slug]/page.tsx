import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { getArticleBySlug, getAllArticles } from "@/lib/scalehub/data";
import { formatDate } from "@/lib/scalehub/content";
import { site } from "@/lib/site";

export const revalidate = 300;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticleBySlug(slug);
  if (!a) return { title: "Artikel tidak ditemukan" };
  return {
    title: a.title,
    description: a.excerpt,
    alternates: { canonical: `/scalehub/${a.slug}` },
    openGraph: {
      type: "article",
      siteName: site.name,
      locale: "id_ID",
      title: a.title,
      description: a.excerpt,
      url: `${site.url}/scalehub/${a.slug}`,
      publishedTime: a.date,
      authors: [a.authorName],
      ...(a.coverUrl ? { images: [{ url: a.coverUrl }] } : {}),
    },
    twitter: {
      card: a.coverUrl ? "summary_large_image" : "summary",
      title: a.title,
      description: a.excerpt,
    },
  };
}

export default async function ScaleHubArticle({ params }: Params) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const all = await getAllArticles();
  const more = all.filter((p) => p.slug !== slug).slice(0, 2);

  const authorNode =
    article.source === "scaleup"
      ? { "@type": "Organization", name: "ScaleUp" }
      : { "@type": "Organization", name: article.authorName };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.date,
    articleSection: article.category,
    ...(article.coverUrl ? { image: article.coverUrl } : {}),
    author: authorNode,
    publisher: {
      "@type": "Organization",
      name: site.name,
      url: site.url,
    },
    mainEntityOfPage: `${site.url}/scalehub/${article.slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <SiteHeader />
      <main className="pt-28 sm:pt-32">
        <article className="bg-hero-glow pb-16">
          <Container className="max-w-3xl">
            <Link
              href="/scalehub"
              className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-coral"
            >
              <ArrowLeft className="h-4 w-4" />
              Semua artikel
            </Link>

            <div className="mt-8 flex flex-wrap items-center gap-3 font-mono text-xs text-slate-500">
              <span
                className={
                  article.source === "scaleup"
                    ? "inline-flex items-center rounded-full border border-coral/25 bg-coral/10 px-3 py-1 uppercase tracking-wider text-coral-soft"
                    : "inline-flex items-center rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 uppercase tracking-wider text-sky-300"
                }
              >
                {article.source === "scaleup" ? "ScaleUp" : article.authorName}
              </span>
              <span>{article.category}</span>
              <span className="h-1 w-1 rounded-full bg-slate-600" />
              <span>{formatDate(article.date)}</span>
              <span className="h-1 w-1 rounded-full bg-slate-600" />
              <span>{article.readMinutes} menit baca</span>
            </div>

            <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight tracking-tight text-mist sm:text-4xl md:text-[2.6rem]">
              {article.title}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-300">
              {article.excerpt}
            </p>
          </Container>
        </article>

        <Container className="max-w-3xl pb-16">
          {article.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.coverUrl}
              alt={article.title}
              className="mb-10 w-full rounded-3xl border border-white/8 object-cover"
            />
          )}

          <div className="space-y-6">
            {article.content.map((block, i) => {
              if (block.type === "h2") {
                return (
                  <h2
                    key={i}
                    className="pt-4 font-display text-2xl font-bold text-mist"
                  >
                    {block.text}
                  </h2>
                );
              }
              if (block.type === "ul") {
                return (
                  <ul key={i} className="space-y-3">
                    {block.items.map((it, j) => (
                      <li key={j} className="flex items-start gap-3">
                        <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
                        <span className="text-base leading-relaxed text-slate-300">
                          {it}
                        </span>
                      </li>
                    ))}
                  </ul>
                );
              }
              return (
                <p key={i} className="text-base leading-[1.8] text-slate-300">
                  {block.text}
                </p>
              );
            })}
          </div>

          {/* inline CTA */}
          <div className="mt-14 overflow-hidden rounded-3xl border border-coral/20 bg-gradient-to-br from-coral/10 via-card/50 to-card/50 p-8 text-center">
            <h3 className="font-display text-xl font-bold text-mist">
              Mau brand Anda tampil di ScaleHub juga?
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
              Jalankan audit ScaleUp — kami bantu bangun konten, website, dan
              sistem yang menaikkan omzet Anda.
            </p>
            <div className="mt-6 flex justify-center">
              <Button href="/mulai">
                Audit Bisnis Saya
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </div>
          </div>
        </Container>

        {/* more articles */}
        {more.length > 0 && (
          <section className="border-t border-white/8 bg-surface/40 py-16">
            <Container className="max-w-4xl">
              <h2 className="mb-8 font-display text-xl font-bold text-mist">
                Baca juga
              </h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {more.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/scalehub/${p.slug}`}
                    className="group rounded-2xl border border-white/8 bg-card/40 p-6 transition-all hover:-translate-y-1 hover:border-coral/30"
                  >
                    <span className="font-mono text-[0.68rem] uppercase tracking-wider text-coral-soft">
                      {p.source === "scaleup" ? "ScaleUp" : p.authorName}
                    </span>
                    <h3 className="mt-3 font-display text-base font-bold leading-snug text-mist transition-colors group-hover:text-coral-soft">
                      {p.title}
                    </h3>
                  </Link>
                ))}
              </div>
            </Container>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
