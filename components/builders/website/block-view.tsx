import type { WebBlock, WebsiteTheme } from "@/lib/builders/website/schema";

function s(props: Record<string, unknown>, key: string): string {
  const v = props[key];
  return typeof v === "string" ? v : "";
}
function list(props: Record<string, unknown>, key: string): Record<string, string>[] {
  const v = props[key];
  return Array.isArray(v) ? (v as Record<string, string>[]) : [];
}

/** Renders one website block as real (light-theme) site markup. Shared by the
 *  builder canvas and the public /site renderer. */
export function BlockView({
  block,
  theme,
}: {
  block: WebBlock;
  theme: WebsiteTheme;
}) {
  const p = block.props;
  const primary = theme.primary || "#FF5733";

  switch (block.type) {
    case "hero":
      return (
        <section
          className="relative overflow-hidden px-6 py-20 text-center sm:py-28"
          style={{
            background: s(p, "image")
              ? `linear-gradient(rgba(15,15,20,0.55),rgba(15,15,20,0.55)), url(${s(p, "image")}) center/cover`
              : `linear-gradient(135deg, ${primary}14, #ffffff)`,
          }}
        >
          <div className="mx-auto max-w-3xl">
            <h1
              className={`font-display text-4xl font-extrabold tracking-tight sm:text-5xl ${s(p, "image") ? "text-white" : "text-slate-900"}`}
            >
              {s(p, "headline")}
            </h1>
            <p
              className={`mx-auto mt-4 max-w-xl text-lg ${s(p, "image") ? "text-slate-100" : "text-slate-600"}`}
            >
              {s(p, "subheadline")}
            </p>
            {s(p, "ctaText") && (
              <a
                href={s(p, "ctaHref") || "#"}
                className="mt-8 inline-block rounded-full px-7 py-3 text-sm font-semibold text-white shadow-lg"
                style={{ backgroundColor: primary }}
              >
                {s(p, "ctaText")}
              </a>
            )}
          </div>
        </section>
      );

    case "features":
      return (
        <section className="bg-white px-6 py-16">
          <div className="mx-auto max-w-5xl">
            {s(p, "title") && (
              <h2 className="mb-10 text-center font-display text-3xl font-bold text-slate-900">
                {s(p, "title")}
              </h2>
            )}
            <div className="grid gap-6 sm:grid-cols-3">
              {list(p, "items").map((it, i) => (
                <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 p-6">
                  <div
                    className="mb-3 h-10 w-10 rounded-xl"
                    style={{ backgroundColor: `${primary}22`, border: `1px solid ${primary}55` }}
                  />
                  <h3 className="font-semibold text-slate-900">{it.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600">{it.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );

    case "about":
      return (
        <section className="bg-white px-6 py-16">
          <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-bold text-slate-900">{s(p, "title")}</h2>
              <p className="mt-4 whitespace-pre-wrap leading-relaxed text-slate-600">{s(p, "text")}</p>
            </div>
            <div className="aspect-video overflow-hidden rounded-2xl bg-slate-100">
              {s(p, "image") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s(p, "image")} alt={s(p, "title")} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  Gambar
                </div>
              )}
            </div>
          </div>
        </section>
      );

    case "products":
      return (
        <section className="bg-slate-50 px-6 py-16">
          <div className="mx-auto max-w-5xl">
            {s(p, "title") && (
              <h2 className="mb-10 text-center font-display text-3xl font-bold text-slate-900">
                {s(p, "title")}
              </h2>
            )}
            <div className="grid gap-6 sm:grid-cols-3">
              {list(p, "items").map((it, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                  <div className="aspect-square bg-slate-100">
                    {it.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.image} alt={it.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-400">
                        Foto
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-900">{it.name}</h3>
                    <p className="mt-1 font-bold" style={{ color: primary }}>
                      {it.price}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );

    case "testimonial":
      return (
        <section className="bg-white px-6 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-display text-2xl font-medium leading-relaxed text-slate-800">
              {s(p, "quote")}
            </p>
            <p className="mt-4 text-sm font-semibold" style={{ color: primary }}>
              {s(p, "author")}
            </p>
          </div>
        </section>
      );

    case "cta":
      return (
        <section id="kontak" className="px-6 py-16" style={{ backgroundColor: `${primary}12` }}>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold text-slate-900">{s(p, "headline")}</h2>
            <p className="mt-3 text-slate-600">{s(p, "text")}</p>
            {s(p, "buttonText") && (
              <a
                href={s(p, "buttonHref") || "#"}
                className="mt-7 inline-block rounded-full px-7 py-3 text-sm font-semibold text-white shadow-lg"
                style={{ backgroundColor: primary }}
              >
                {s(p, "buttonText")}
              </a>
            )}
          </div>
        </section>
      );

    case "contact":
      return (
        <section className="bg-white px-6 py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-3xl font-bold text-slate-900">{s(p, "title")}</h2>
            <div className="mt-6 flex flex-col items-center gap-2 text-slate-600">
              {s(p, "whatsapp") && <p>WhatsApp: {s(p, "whatsapp")}</p>}
              {s(p, "email") && <p>Email: {s(p, "email")}</p>}
              {s(p, "address") && <p className="whitespace-pre-wrap">{s(p, "address")}</p>}
            </div>
          </div>
        </section>
      );

    case "footer":
      return (
        <footer className="bg-slate-900 px-6 py-8 text-center text-sm text-slate-400">
          {s(p, "text")}
        </footer>
      );

    default:
      return null;
  }
}
