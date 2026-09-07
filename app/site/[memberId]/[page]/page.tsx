import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSite } from "@/lib/builders/website/load";
import { getPage } from "@/lib/builders/website/schema";
import { heroImage, siteBase, faqGraph, breadcrumbGraph } from "@/lib/builders/website/seo";
import { getAdminUser } from "@/lib/admin/auth";
import { SiteChrome } from "@/components/builders/website/site-chrome";
import { BlockView } from "@/components/builders/website/block-view";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ memberId: string; page: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { memberId, page } = await params;
  const s = await loadSite(memberId);
  const pg = s?.doc ? getPage(s.doc, page) : undefined;
  if (!s?.doc || !pg) return { title: s?.brand ?? "Website" };
  const ph = pg.blocks.find((b) => b.type === "pageheader");
  const desc =
    (typeof ph?.props.subtitle === "string" && ph.props.subtitle) ||
    `${pg.name} — ${s.brand}`;
  const img = heroImage(s.doc);
  const url = `${siteBase(memberId)}/${page}`;
  return {
    title: `${pg.name} · ${s.brand}`,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: s.brand,
      locale: "id_ID",
      title: `${pg.name} · ${s.brand}`,
      description: desc,
      url,
      ...(img ? { images: [img] } : {}),
    },
    twitter: { card: img ? "summary_large_image" : "summary", title: `${pg.name} · ${s.brand}`, description: desc },
    robots: { index: true, follow: true },
  };
}

export default async function SiteInnerPage({ params, searchParams }: Params) {
  const { memberId, page } = await params;
  const preview = (await searchParams).preview === "1";
  const allowDraft = preview && !!(await getAdminUser());
  const s = await loadSite(memberId, { allowDraft });
  if (!s || !s.doc) notFound();
  const pg = getPage(s.doc, page);
  if (!pg) notFound();

  const extraLd = [
    ...faqGraph(pg.blocks),
    ...breadcrumbGraph(memberId, [
      { name: "Home", slug: "" },
      { name: pg.name, slug: pg.slug },
    ]),
  ];

  return (
    <SiteChrome doc={s.doc} memberId={memberId} activeSlug={page} extraLd={extraLd} preview={preview}>
      {pg.blocks.map((b) => (
        <BlockView key={b.id} block={b} theme={s.doc!.theme} ctx={{ memberId, preview }} />
      ))}
    </SiteChrome>
  );
}
