import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { posts, formatDate } from "@/lib/blog";

export function BlogTeaser() {
  const latest = posts.slice(0, 3);
  return (
    <section className="relative border-t border-white/5 bg-surface/40 py-24 sm:py-28">
      <Container>
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading
            align="left"
            eyebrow="Blog"
            title="Wawasan untuk bisnis yang mau naik kelas"
            subtitle="Strategi GEO, CRO, dan otomatisasi — dibongkar dengan bahasa yang membumi."
          />
          <Link
            href="/blog"
            className="inline-flex shrink-0 items-center gap-2 font-display text-sm font-semibold text-coral transition-colors hover:text-coral-soft"
          >
            Lihat semua artikel
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {latest.map((p) => (
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
              <h3 className="mt-5 font-display text-lg font-bold leading-snug text-mist transition-colors group-hover:text-coral-soft">
                {p.title}
              </h3>
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
  );
}
