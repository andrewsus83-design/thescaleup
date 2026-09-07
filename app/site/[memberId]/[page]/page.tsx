import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSite } from "@/lib/builders/website/load";
import { getPage } from "@/lib/builders/website/schema";
import { SiteChrome } from "@/components/builders/website/site-chrome";
import { BlockView } from "@/components/builders/website/block-view";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ memberId: string; page: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { memberId, page } = await params;
  const site = await loadSite(memberId);
  const pg = site?.doc ? getPage(site.doc, page) : undefined;
  const title = pg ? `${pg.name} · ${site!.brand}` : (site?.brand ?? "Website");
  return { title, robots: { index: false, follow: false } };
}

export default async function SiteInnerPage({ params }: Params) {
  const { memberId, page } = await params;
  const site = await loadSite(memberId);
  if (!site || !site.doc) notFound();
  const pg = getPage(site.doc, page);
  if (!pg) notFound();

  return (
    <SiteChrome doc={site.doc} memberId={memberId} activeSlug={page}>
      {pg.blocks.map((b) => (
        <BlockView key={b.id} block={b} theme={site.doc!.theme} ctx={{ memberId }} />
      ))}
    </SiteChrome>
  );
}
