import type { WebsiteDoc } from "@/lib/builders/website/schema";
import { SOCIAL_PLATFORMS } from "@/lib/builders/website/schema";
import { siteGraph, jsonLdString } from "@/lib/builders/website/seo";

function waLink(whatsapp?: string): string | null {
  const digits = (whatsapp ?? "").replace(/[^0-9]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function safeImg(u?: string): string {
  const v = String(u ?? "").trim();
  return v.startsWith("/") || /^https?:\/\//i.test(v) ? v : "";
}

function safeHref(u?: string): string {
  const v = String(u ?? "").trim();
  if (!v) return "#";
  if (v.startsWith("#") || v.startsWith("/")) return v;
  return /^(https?:|mailto:|tel:)/i.test(v) ? v : "#";
}

/** Nav header + footer shared across all pages of a built site. */
export function SiteChrome({
  doc,
  memberId,
  activeSlug,
  extraLd = [],
  preview = false,
  children,
}: {
  doc: WebsiteDoc;
  memberId: string;
  activeSlug: string;
  extraLd?: object[];
  preview?: boolean;
  children: React.ReactNode;
}) {
  const primary = doc.theme.primary || "#FF5733";
  const brand = doc.theme.brand || "Brand";
  const wa = waLink(doc.theme.whatsapp);
  const logo = safeImg(doc.theme.logo);
  const q = preview ? "?preview=1" : "";
  const href = (slug: string) => (slug ? `/site/${memberId}/${slug}${q}` : `/site/${memberId}${q}`);
  const socials = SOCIAL_PLATFORMS
    .map((sp) => ({ label: sp.label, url: safeHref(doc.theme.socials?.[sp.key]) }))
    .filter((x) => x.url !== "#");
  const footerCols = doc.theme.footerCols?.filter((c) => c && c.title && c.links?.length) ?? [];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString([...siteGraph(doc, memberId), ...extraLd]) }}
      />
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <a href={href("")} className="flex items-center gap-2 font-display text-lg font-extrabold">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={brand} className="h-8 w-auto" />
            ) : (
              <span style={{ color: primary }}>{brand}</span>
            )}
          </a>
          <nav className="hidden items-center gap-1 md:flex">
            {doc.pages.map((pg) => {
              const active = pg.slug === activeSlug;
              return (
                <a
                  key={pg.id}
                  href={href(pg.slug)}
                  className="rounded-full px-3.5 py-2 text-sm font-medium transition-colors"
                  style={active ? { color: primary } : { color: "#475569" }}
                >
                  {pg.name}
                </a>
              );
            })}
          </nav>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm"
              style={{ backgroundColor: primary }}
            >
              Hubungi
            </a>
          )}
        </div>
        {/* mobile nav */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden">
          {doc.pages.map((pg) => (
            <a
              key={pg.id}
              href={href(pg.slug)}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium"
              style={pg.slug === activeSlug ? { color: primary } : { color: "#64748b" }}
            >
              {pg.name}
            </a>
          ))}
        </nav>
      </header>

      <main>{children}</main>

      <footer className="border-t border-slate-800 bg-slate-900 px-6 py-12 text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* brand + socials */}
          <div>
            <p className="font-display text-lg font-extrabold text-white">{brand}</p>
            <p className="mt-2 text-sm text-slate-400">
              {doc.theme.tagline || `Website resmi ${brand}.`}
            </p>
            {socials.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {socials.map((soc) => (
                  <a
                    key={soc.label}
                    href={soc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition-colors hover:border-white hover:text-white"
                  >
                    {soc.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* auto pages column */}
          <div>
            <p className="mb-2 text-sm font-semibold text-white">Halaman</p>
            <ul className="space-y-1 text-sm text-slate-400">
              {doc.pages.map((pg) => (
                <li key={pg.id}>
                  <a href={href(pg.slug)} className="hover:text-white">{pg.name}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* custom columns (Legal, Sosial, dll) */}
          {footerCols.slice(0, 2).map((col, i) => (
            <div key={i}>
              <p className="mb-2 text-sm font-semibold text-white">{col.title}</p>
              <ul className="space-y-1 text-sm text-slate-400">
                {col.links.map((l, j) => (
                  <li key={j}>
                    <a href={safeHref(l.href)} className="hover:text-white">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* contact column when no custom columns */}
          {footerCols.length === 0 && (
            <div className="lg:col-span-2">
              <p className="mb-2 text-sm font-semibold text-white">Kontak</p>
              {doc.theme.whatsapp && <p className="text-sm text-slate-400">WA: {doc.theme.whatsapp}</p>}
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-full px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: primary }}>
                  Chat WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
        <div className="mx-auto mt-8 max-w-6xl border-t border-slate-800 pt-5 text-center text-xs text-slate-500">
          © 2026 {brand}. Dibuat dengan ScaleUp.
        </div>
      </footer>
    </div>
  );
}
