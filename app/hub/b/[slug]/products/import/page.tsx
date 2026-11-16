import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { ImportWizard } from "@/components/hub/products/import-wizard";
import { ProductsNav, productsBase } from "@/components/hub/products/parts";
import { requireFunction } from "@/lib/hub/access";
import { listStores } from "@/lib/hub/products/data";

export const metadata: Metadata = { title: "Import stock" };
export const dynamic = "force-dynamic";

export default async function ImportPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand } = await requireFunction(slug, "products", "edit");
  const stores = await listStores(brand.id);
  const initial = Array.isArray(sp.store) ? sp.store[0] : sp.store;
  const base = productsBase(slug);
  return (
    <>
      <PageHeader title="Import stock" description="Bring in a store's stock list from Excel or CSV. Products with the same SKU are one product, whichever store they come from." />
      <ProductsNav slug={slug} active="import" canEdit />
      {stores.length === 0 ? (
        <EmptyState icon={<Store className="size-6" aria-hidden />} title="Add a store first" hint="A store is the place the file comes from: a Desty account, a Shopify shop, a POS outlet.">
          <Link href={`${base}/stores`} className={btnCls("primary", "md")}>
            Add a store
          </Link>
        </EmptyState>
      ) : (
        <ImportWizard brandId={brand.id} slug={slug} stores={stores.map((s) => ({ id: s.id, name: s.name }))} initialStore={initial} />
      )}
    </>
  );
}
