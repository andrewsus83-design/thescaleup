import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { AddStoreForm, DeleteStore } from "@/components/hub/products/forms";
import { KindChip, ProductsNav, ago, productsBase } from "@/components/hub/products/parts";
import { requireFunction } from "@/lib/hub/access";
import { atLeast } from "@/lib/hub/permissions";
import { listStores, loadCatalog } from "@/lib/hub/products/data";
import { fmtNum, storeTotals } from "@/lib/hub/products/model";
import { canManageTeam } from "@/lib/hub/rules";

export const metadata: Metadata = { title: "Stores" };
export const dynamic = "force-dynamic";

export default async function StoresPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, access, actor } = await requireFunction(slug, "products");
  const canEdit = atLeast(access.products, "edit");
  const base = productsBase(slug);
  const [stores, { items }] = await Promise.all([listStores(brand.id), loadCatalog(brand.id)]);
  const totals = storeTotals(items);

  return (
    <>
      <PageHeader title="Stores" description="The places the brand sells: a Desty account, a Shopify shop, a POS outlet. Each one holds its own stock; the catalog adds them up." />
      <ProductsNav slug={slug} active="stores" canEdit={canEdit} />
      {canEdit && (
        <Card small className="mb-6">
          <h2 className="mb-4 text-body font-semibold text-ink-800">Add a store</h2>
          <AddStoreForm brandId={brand.id} />
        </Card>
      )}
      {stores.length === 0 ? (
        <EmptyState icon={<Store className="size-6" aria-hidden />} title="No stores yet" hint={canEdit ? "Add each place you sell, then import its stock list. Use the same SKU everywhere so one product is one row." : "No store has been added yet."} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {stores.map((s) => {
            const t = totals.get(s.id) ?? { products: 0, units: 0 };
            return (
              <li key={s.id}>
                <Card small className="h-full">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="text-body font-semibold text-ink-800">{s.name}</h2>
                    <KindChip kind={s.kind} />
                  </div>
                  <p className="mt-2 text-small text-ink-500">
                    {fmtNum(t.products)} {t.products === 1 ? "product" : "products"}, {fmtNum(t.units)} units. Last import {ago(s.last_import_at)}
                    {s.last_import_rows !== null && s.last_import_at ? ` (${fmtNum(s.last_import_rows)} rows)` : ""}.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Link href={`${base}?store=${s.id}`} className={btnCls("secondary", "xs")}>
                      See its stock
                    </Link>
                    {canEdit && (
                      <Link href={`${base}/import?store=${s.id}`} className={btnCls("secondary", "xs")}>
                        Import
                      </Link>
                    )}
                    {canEdit && canManageTeam(actor) && <DeleteStore brandId={brand.id} id={s.id} name={s.name} products={t.products} />}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
