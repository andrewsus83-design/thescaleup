import type { Metadata } from "next";
import Link from "next/link";
import { Package, Search, X } from "lucide-react";
import { Alert, Chip, EmptyState, PageHeader } from "@/components/brand/primitives";
import { btnCls, iconBtnCls, pillCls, tileCls } from "@/components/brand/styles";
import { ProductsNav, Stat, StockChip, productsBase } from "@/components/hub/products/parts";
import { requireFunction } from "@/lib/hub/access";
import { atLeast } from "@/lib/hub/permissions";
import { searchTerm } from "@/lib/hub/mail/model";
import { listStores, loadCatalog } from "@/lib/hub/products/data";
import { catalogTotals, filterCatalog, fmtNum, stockState, type CatalogSort, type StockState } from "@/lib/hub/products/model";
import { UUID } from "@/lib/hub/tasks/context";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

const PER_PAGE = 50;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

type F = { q?: string; state?: StockState; store?: string; sort?: CatalogSort; page?: number };
function href(base: string, f: F) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.state) p.set("show", f.state);
  if (f.store) p.set("store", f.store);
  if (f.sort === "stock") p.set("sort", "stock");
  if (f.page && f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

export default async function ProductsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand, access } = await requireFunction(slug, "products");
  const canEdit = atLeast(access.products, "edit");
  const base = productsBase(slug);
  const [stores, { items, total }] = await Promise.all([listStores(brand.id), loadCatalog(brand.id)]);
  const storeName = new Map(stores.map((s) => [s.id, s.name]));

  const q = searchTerm(one(sp.q));
  const show = one(sp.show);
  const state: StockState | undefined = show === "low" || show === "out" ? show : undefined;
  const rawStore = one(sp.store) ?? "";
  const store = UUID.test(rawStore) && storeName.has(rawStore) ? rawStore : undefined;
  const sort: CatalogSort = one(sp.sort) === "stock" ? "stock" : "name";
  const filtered = Boolean(q || state || store);
  const rows = filterCatalog(items, { q, state, storeId: store, sort });
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(one(sp.page))) || 1));
  const shown = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const t = catalogTotals(items);
  const cur: F = { q, state, store, sort };

  return (
    <>
      <PageHeader
        title="Products"
        description="One list of what the brand sells, with stock added up across every store."
        action={
          canEdit && (
            <Link href={`${base}/import`} className={btnCls("primary", "md")}>
              Import stock
            </Link>
          )
        }
      />
      <ProductsNav slug={slug} active="catalog" canEdit={canEdit} />

      {items.length === 0 ? (
        <EmptyState icon={<Package className="size-6" aria-hidden />} title="No products yet" hint={canEdit ? "Export the stock list from Desty, your POS or Shopify as Excel or CSV and import it. Do it for each store and the numbers are added up here." : "Nothing has been imported yet."}>
          {canEdit && (
            <Link href={`${base}/import`} className={btnCls("primary", "md")}>
              Import stock
            </Link>
          )}
        </EmptyState>
      ) : (
        <>
          {total > items.length && (
            <Alert tone="warn" className="mb-4">
              Showing the first {fmtNum(items.length)} of {fmtNum(total)} products, by name. Search for one to find the rest.
            </Alert>
          )}
          <dl className={`${tileCls} mb-6 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4`}>
            <Stat label="Products" value={fmtNum(t.products)} />
            <Stat label="Units in stock" value={fmtNum(t.units)} />
            <Stat label="Low" value={fmtNum(t.low)} />
            <Stat label="Out of stock" value={fmtNum(t.out)} />
          </dl>

          <form role="search" method="get" action={base} className="relative mb-4">
            {state && <input type="hidden" name="show" value={state} />}
            {store && <input type="hidden" name="store" value={store} />}
            {sort === "stock" && <input type="hidden" name="sort" value="stock" />}
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-500" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={q}
              maxLength={80}
              autoComplete="off"
              aria-label="Search by name or SKU"
              placeholder="Search by name or SKU"
              className="block h-12 w-full rounded-full border-control border-transparent bg-paper-0 pr-12 pl-12 text-body text-ink-800 outline-none placeholder:text-ink-500 focus-visible:border-ink-800 focus-visible:shadow-focus"
            />
            {filtered && (
              <Link href={base} aria-label="Clear the search and filters" className={iconBtnCls("quiet", "absolute top-1/2 right-1 size-10 -translate-y-1/2")}>
                <X className="size-4" aria-hidden />
              </Link>
            )}
          </form>

          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Stock level">
            <Link href={href(base, { ...cur, state: undefined })} aria-pressed={!state} className={pillCls(!state)}>
              All
            </Link>
            <Link href={href(base, { ...cur, state: "low" })} aria-pressed={state === "low"} className={pillCls(state === "low")}>
              Low
              <span className="font-mono text-micro opacity-70">{t.low}</span>
            </Link>
            <Link href={href(base, { ...cur, state: "out" })} aria-pressed={state === "out"} className={pillCls(state === "out")}>
              Out of stock
              <span className="font-mono text-micro opacity-70">{t.out}</span>
            </Link>
            <Link href={href(base, { ...cur, sort: sort === "stock" ? "name" : "stock" })} aria-pressed={sort === "stock"} className={pillCls(sort === "stock")}>
              Lowest stock first
            </Link>
          </div>
          {stores.length > 1 && (
            <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Store">
              <Link href={href(base, { ...cur, store: undefined })} aria-pressed={!store} className={pillCls(!store)}>
                All stores
              </Link>
              {stores.map((s) => (
                <Link key={s.id} href={href(base, { ...cur, store: store === s.id ? undefined : s.id })} aria-pressed={store === s.id} className={pillCls(store === s.id)}>
                  {s.name}
                </Link>
              ))}
            </div>
          )}

          {rows.length === 0 ? (
            <EmptyState icon={<Search className="size-6" aria-hidden />} title="No products match" hint="Try fewer words, or clear the filters." />
          ) : (
            <>
              <p className="mb-3 text-small text-ink-500">
                {fmtNum(rows.length)} {rows.length === 1 ? "product" : "products"}
                {store ? ` in ${storeName.get(store)}` : ""}. The big number adds up every store.
              </p>
              <ul className="divide-y divide-hairline rounded-bubble border border-hairline bg-paper-0">
                {shown.map((it) => {
                  const st = stockState(it.total, it.low);
                  return (
                    <li key={it.id}>
                      <Link href={`${base}/${it.id}`} className="flex items-start gap-4 px-4 py-3 hover:bg-paper-100 focus-visible:shadow-focus focus-visible:outline-none sm:px-5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body font-semibold text-ink-800">{it.name || it.sku}</span>
                          <span className="mt-0.5 block truncate font-mono text-micro text-ink-500">{it.sku}</span>
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            {it.stores.length === 0 && <span className="text-caption text-ink-500">Not in any store yet</span>}
                            {[...it.stores]
                              .sort((a, b) => (storeName.get(a.storeId) ?? "").localeCompare(storeName.get(b.storeId) ?? ""))
                              .map((s) => (
                                <Chip key={s.storeId} tone={s.stock <= 0 ? "bad" : "neutral"}>
                                  {storeName.get(s.storeId) ?? "Store"} <span className="font-mono">{fmtNum(s.stock)}</span>
                                </Chip>
                              ))}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className="font-mono text-h3 font-medium text-ink-800">{fmtNum(it.total)}</span>
                          <StockChip state={st} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {pages > 1 && (
                <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3">
                  {page > 1 ? (
                    <Link href={href(base, { ...cur, page: page - 1 })} className={btnCls("secondary", "sm")}>
                      Previous
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span className="text-small text-ink-500">
                    Page {page} of {pages}
                  </span>
                  {page < pages ? (
                    <Link href={href(base, { ...cur, page: page + 1 })} className={btnCls("secondary", "sm")}>
                      Next
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
