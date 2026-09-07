import type { WebsiteDoc } from "@/lib/builders/website/schema";

function waLink(whatsapp?: string): string | null {
  const digits = (whatsapp ?? "").replace(/[^0-9]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function safeImg(u?: string): string {
  const v = String(u ?? "").trim();
  return v.startsWith("/") || /^https?:\/\//i.test(v) ? v : "";
}

/** Nav header + footer shared across all pages of a built site. */
export function SiteChrome({
  doc,
  memberId,
  activeSlug,
  children,
}: {
  doc: WebsiteDoc;
  memberId: string;
  activeSlug: string;
  children: React.ReactNode;
}) {
  const primary = doc.theme.primary || "#FF5733";
  const brand = doc.theme.brand || "Brand";
  const wa = waLink(doc.theme.whatsapp);
  const logo = safeImg(doc.theme.logo);
  const href = (slug: string) => (slug ? `/site/${memberId}/${slug}` : `/site/${memberId}`);

  return (
    <div className="min-h-screen bg-white text-slate-900">
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

      <footer className="border-t border-slate-800 bg-slate-900 px-6 py-10 text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-3">
          <div>
            <p className="font-display text-lg font-extrabold text-white">{brand}</p>
            <p className="mt-2 text-sm text-slate-400">
              Website resmi {brand}.
            </p>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-white">Halaman</p>
            <ul className="space-y-1 text-sm text-slate-400">
              {doc.pages.map((pg) => (
                <li key={pg.id}>
                  <a href={href(pg.slug)} className="hover:text-white">
                    {pg.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-white">Kontak</p>
            {doc.theme.whatsapp && <p className="text-sm text-slate-400">WA: {doc.theme.whatsapp}</p>}
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block rounded-full px-4 py-2 text-xs font-semibold text-white"
                style={{ backgroundColor: primary }}
              >
                Chat WhatsApp
              </a>
            )}
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-6xl border-t border-slate-800 pt-5 text-center text-xs text-slate-500">
          © 2026 {brand}. Dibuat dengan ScaleUp.
        </div>
      </footer>
    </div>
  );
}
