import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSite } from "@/lib/builders/website/load";
import { getPage } from "@/lib/builders/website/schema";
import { heroImage, siteBase } from "@/lib/builders/website/seo";
import { SiteChrome } from "@/components/builders/website/site-chrome";
import { BlockView } from "@/components/builders/website/block-view";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ memberId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { memberId } = await params;
  const s = await loadSite(memberId);
  if (!s?.doc) return { title: s?.brand ?? "Website" };
  const home = getPage(s.doc, "") ?? s.doc.pages[0];
  const hero = home.blocks.find((b) => b.type === "hero");
  const desc =
    (typeof hero?.props.subheadline === "string" && hero.props.subheadline) ||
    `Website resmi ${s.brand}`;
  const img = heroImage(s.doc);
  const url = siteBase(memberId);
  return {
    title: s.brand,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: s.brand,
      locale: "id_ID",
      title: s.brand,
      description: desc,
      url,
      ...(img ? { images: [img] } : {}),
    },
    twitter: { card: img ? "summary_large_image" : "summary", title: s.brand, description: desc },
    robots: { index: true, follow: true },
  };
}

export default async function SiteHome({ params }: Params) {
  const { memberId } = await params;
  const s = await loadSite(memberId);
  if (!s) notFound();

  if (!s.doc) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-center">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-slate-900">{s.brand}</h1>
          <p className="mt-3 text-slate-500">Website sedang disiapkan.</p>
        </div>
      </main>
    );
  }

  const home = getPage(s.doc, "") ?? s.doc.pages[0];
  return (
    <SiteChrome doc={s.doc} memberId={memberId} activeSlug="">
      {home.blocks.map((b) => (
        <BlockView key={b.id} block={b} theme={s.doc!.theme} ctx={{ memberId }} />
      ))}
    </SiteChrome>
  );
}
