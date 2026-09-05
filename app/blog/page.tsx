import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { posts, formatDate } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Strategi GEO, CRO, otomatisasi, dan scale-up bisnis — dibongkar dengan bahasa yang membumi.",
};

export default function BlogIndex() {
  return (
    <>
      <SiteHeader />
      <main className="pt-28 sm:pt-32">
        <section className="bg-hero-glow pb-14">
          <Container className="text-center">
            <Badge>Blog ScaleUp</Badge>
            <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-extrabold tracking-tight text-mist sm:text-5xl">
              Wawasan untuk bisnis yang{" "}
              <span className="text-gradient-coral">mau naik kelas</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-slate-400">
              Growth, GEO, konversi, dan otomatisasi — tanpa jargon yang bikin
              pusing.
            </p>
          </Container>
        </section>

        <section className="pb-24">
          <Container>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group flex flex-col rounded-3xl border border-white/8 bg-card/40 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-coral/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center rounded-full border border-coral/25 bg-coral/10 px-3 py-1 font-mono text-[0.68rem] uppercase tracking-wider text-coral-soft">
                      {p.category}
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-slate-600 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-coral" />
                  </div>
                  <h2 className="mt-5 font-display text-lg font-bold leading-snug text-mist transition-colors group-hover:text-coral-soft">
                    {p.title}
                  </h2>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">
                    {p.excerpt}
                  </p>
                  <div className="mt-5 flex items-center gap-3 border-t border-white/5 pt-4 font-mono text-xs text-slate-500">
                    <span>{formatDate(p.date)}</span>
                    <span className="h-1 w-1 rounded-full bg-slate-600" />
                    <span>{p.readMinutes} menit baca</span>
                  </div>
                </Link>
              ))}
            </div>
          </Container>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
