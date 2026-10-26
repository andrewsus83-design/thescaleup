import { Newspaper, ExternalLink, ArrowUpRight } from "lucide-react";
import { requireClient } from "@/lib/client/auth";
import { memberPublishedArticles } from "@/lib/scalehub/data";
import { formatDate } from "@/lib/scalehub/content";
import { PageHeader, EmptyState } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function ClientScaleHubPage() {
  const m = await requireClient();
  const articles = await memberPublishedArticles(m.id);

  return (
    <div>
      <PageHeader
        title="Konten di ScaleHub"
        description="Artikel yang tim ScaleUp buat & terbitkan untuk brand Anda — tampil publik di ScaleHub."
        action={
          <a
            href="/scalehub"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/10"
          >
            <ExternalLink className="h-4 w-4" /> Buka ScaleHub
          </a>
        }
      />

      {articles.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="h-5 w-5" />}
          title="Belum ada artikel terbit"
          hint="Saat tim ScaleUp menerbitkan konten untuk brand Anda, artikelnya akan muncul di sini dan di ScaleHub publik."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {articles.map((a) => (
            <a
              key={a.slug}
              href={`/scalehub/${a.slug}`}
              target="_blank"
              rel="noreferrer"
              className="group flex flex-col rounded-2xl border border-white/8 bg-card/40 p-5 transition-all hover:-translate-y-1 hover:border-coral/30"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center rounded-full border border-coral/25 bg-coral/10 px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-wider text-coral-soft">
                  {a.category}
                </span>
                <ArrowUpRight className="h-4 w-4 text-slate-600 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-coral" />
              </div>
              <h2 className="mt-3 font-display text-base font-bold leading-snug text-mist transition-colors group-hover:text-coral-soft">
                {a.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
                {a.excerpt}
              </p>
              <div className="mt-4 flex items-center gap-3 border-t border-white/5 pt-3 font-mono text-xs text-slate-500">
                <span>{formatDate(a.date)}</span>
                <span className="h-1 w-1 rounded-full bg-slate-600" />
                <span>{a.readMinutes} menit baca</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
