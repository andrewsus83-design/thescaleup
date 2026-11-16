import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand/primitives";
import { DeletePage, PageForm } from "@/components/hub/wiki/forms";
import { wikiBase } from "@/components/hub/wiki/parts";
import { requireFunction } from "@/lib/hub/access";
import { getPageBySlug, listChildren, listNodes } from "@/lib/hub/wiki/data";
import { flatten } from "@/lib/hub/wiki/model";

export const metadata: Metadata = { title: "Edit page" };
export const dynamic = "force-dynamic";

export default async function EditWikiPage({ params }: { params: Promise<{ slug: string; pageSlug: string }> }) {
  const { slug, pageSlug } = await params;
  const { brand } = await requireFunction(slug, "wiki", "edit");
  const page = await getPageBySlug(brand.id, pageSlug);
  if (!page) notFound();
  const [nodes, kids] = await Promise.all([listNodes(brand.id), listChildren(brand.id, page.id)]);
  const parents = flatten(nodes, page.id).map((n) => ({ id: n.id, title: n.title, depth: n.depth }));
  const here = `${wikiBase(slug)}/${page.slug}`;
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Edit page"
        action={
          <Link href={here} className="text-small font-semibold text-brand-700 underline underline-offset-4">
            Back to the page
          </Link>
        }
      />
      <PageForm brandId={brand.id} parents={parents} page={page} cancelHref={here} />
      <DeletePage brandId={brand.id} id={page.id} title={page.title} subpages={kids.length} />
    </div>
  );
}
