import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/brand/primitives";
import { PageForm } from "@/components/hub/wiki/forms";
import { wikiBase } from "@/components/hub/wiki/parts";
import { requireFunction } from "@/lib/hub/access";
import { listNodes } from "@/lib/hub/wiki/data";
import { flatten } from "@/lib/hub/wiki/model";

export const metadata: Metadata = { title: "New page" };
export const dynamic = "force-dynamic";

export default async function NewWikiPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ parent?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand } = await requireFunction(slug, "wiki", "edit");
  const parents = flatten(await listNodes(brand.id)).map((n) => ({ id: n.id, title: n.title, depth: n.depth }));
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="New page"
        action={
          <Link href={wikiBase(slug)} className="text-small font-semibold text-brand-700 underline underline-offset-4">
            Back to the Wiki
          </Link>
        }
      />
      <PageForm brandId={brand.id} parents={parents} parentId={typeof sp.parent === "string" ? sp.parent : undefined} cancelHref={wikiBase(slug)} />
    </div>
  );
}
