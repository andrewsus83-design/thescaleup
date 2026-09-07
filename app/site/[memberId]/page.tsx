import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSite } from "@/lib/builders/website/load";
import { getPage } from "@/lib/builders/website/schema";
import { SiteChrome } from "@/components/builders/website/site-chrome";
import { BlockView } from "@/components/builders/website/block-view";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ memberId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { memberId } = await params;
  const site = await loadSite(memberId);
  return { title: site?.brand ?? "Website", robots: { index: false, follow: false } };
}

export default async function SiteHome({ params }: Params) {
  const { memberId } = await params;
  const site = await loadSite(memberId);
  if (!site) notFound();

  if (!site.doc) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-center">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-slate-900">{site.brand}</h1>
          <p className="mt-3 text-slate-500">Website sedang disiapkan.</p>
        </div>
      </main>
    );
  }

  const home = getPage(site.doc, "") ?? site.doc.pages[0];
  return (
    <SiteChrome doc={site.doc} memberId={memberId} activeSlug="">
      {home.blocks.map((b) => (
        <BlockView key={b.id} block={b} theme={site.doc!.theme} ctx={{ memberId }} />
      ))}
    </SiteChrome>
  );
}
