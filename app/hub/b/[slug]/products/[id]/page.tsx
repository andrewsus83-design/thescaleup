import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Chip } from "@/components/brand/primitives";
import { DeleteProduct, ProductForm } from "@/components/hub/products/forms";
import { StockChip, ago, productsBase } from "@/components/hub/products/parts";
import { requireFunction } from "@/lib/hub/access";
import { atLeast } from "@/lib/hub/permissions";
import { getProduct, listStores } from "@/lib/hub/products/data";
import { DEFAULT_LOW, fmtNum, fmtPrice, priceRange, stockState } from "@/lib/hub/products/model";
import { canManageTeam } from "@/lib/hub/rules";
import { UUID } from "@/lib/hub/tasks/context";

export const metadata: Metadata = { title: "Product" };
export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { brand, access, actor } = await requireFunction(slug, "products");
  if (!UUID.test(id)) notFound();
  const [item, stores] = await Promise.all([getProduct(brand.id, id), listStores(brand.id)]);
  if (!item) notFound();
  const canEdit = atLeast(access.products, "edit");
  const base = productsBase(slug);
  const name = new Map(stores.map((s) => [s.id, s.name]));
  const state = stockState(item.total, item.low);
  const range = priceRange(item);
  const rows = [...item.stores].sort((a, b) => (name.get(a.storeId) ?? "").localeCompare(name.get(b.storeId) ?? ""));

  return (
    <>
      <p className="mb-2 text-small">
        <Link href={base} className="font-semibold text-brand-700 underline underline-offset-4">
          Products
        </Link>
      </p>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-h2 font-extrabold text-ink-800">{item.name || item.sku}</h1>
          <StockChip state={state} />
        </div>
        <p className="mt-1 font-mono text-small text-ink-500">{item.sku}</p>
      </header>

      <Card small className="mb-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-body font-semibold text-ink-800">Stock</h2>
          <p className="text-small text-ink-500">
            Total <span className="font-mono text-h3 font-medium text-ink-800">{fmtNum(item.total)}</span>
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="mt-3 text-small text-ink-500">Not in any store yet. Import a stock list that has this SKU.</p>
        ) : (
          <ul className="mt-3 divide-y divide-hairline">
            {rows.map((r) => (
              <li key={r.storeId} className="flex items-center justify-between gap-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-body text-ink-800">{name.get(r.storeId) ?? "Removed store"}</span>
                  <span className="block text-caption text-ink-500">
                    Updated {ago(r.at)}
                    {r.price !== null ? `, price ${fmtPrice(r.price)}` : ""}
                  </span>
                </span>
                <Chip tone={r.stock <= 0 ? "bad" : "neutral"}>
                  <span className="font-mono">{fmtNum(r.stock)}</span>
                </Chip>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-caption text-ink-500">
          Stock comes from each store&apos;s export; to change it, import a newer file for that store.
          {range && range.min !== range.max ? ` Prices differ between stores: ${fmtPrice(range.min)} to ${fmtPrice(range.max)}.` : ""}
        </p>
      </Card>

      {canEdit ? (
        <Card small>
          <h2 className="mb-4 text-body font-semibold text-ink-800">Details</h2>
          <ProductForm brandId={brand.id} item={item} />
          <p className="mt-3 text-caption text-ink-500">Left empty, “low” means {DEFAULT_LOW} or fewer. Prices are shown as written in the file, with no currency.</p>
          {canManageTeam(actor) && <DeleteProduct brandId={brand.id} id={item.id} label={item.name || item.sku} />}
        </Card>
      ) : (
        <Card small>
          <h2 className="mb-2 text-body font-semibold text-ink-800">Details</h2>
          <p className="text-small text-ink-500">Price {fmtPrice(item.price)}. Counts as low at {item.low ?? DEFAULT_LOW} or fewer.</p>
        </Card>
      )}
    </>
  );
}
