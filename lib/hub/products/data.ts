import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isKind, type CatalogItem, type StoreKind } from "./model";

// Reads for the Products pages. They use the service role, so every function takes the brand id and filters on it: the caller has
// already checked that this person may open Products in this brand.

const db = () => createSupabaseAdminClient();

export type Store = { id: string; name: string; kind: StoreKind; last_import_at: string | null; last_import_rows: number | null; created_at: string };

export async function listStores(brandId: string): Promise<Store[]> {
  const { data, error } = await db().from("catalog_stores").select("id, name, kind, last_import_at, last_import_rows, created_at").eq("brand_id", brandId).order("name").limit(200);
  if (error) {
    console.error("[products] stores failed:", error.message);
    return [];
  }
  return (data ?? []).map((s) => ({ ...s, kind: isKind(s.kind) ? s.kind : "other" })) as Store[];
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Every product of the brand with its stock in each store (up to `limit`; `total` is how many exist). */
export async function loadCatalog(brandId: string, limit = 3000): Promise<{ items: CatalogItem[]; total: number }> {
  const { data, error } = await db().rpc("catalog_list", { p_brand: brandId, p_limit: limit });
  if (error || !data || typeof data !== "object") {
    if (error) console.error("[products] catalog failed:", error.message);
    return { items: [], total: 0 };
  }
  const d = data as { total?: unknown; items?: unknown };
  const raw = Array.isArray(d.items) ? d.items : [];
  const items: CatalogItem[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (typeof r?.id !== "string" || typeof r.sku !== "string") continue;
    const stores = (Array.isArray(r.stores) ? (r.stores as Record<string, unknown>[]) : []).flatMap((s) =>
      typeof s?.storeId === "string" && typeof s.stock === "number" ? [{ storeId: s.storeId, stock: s.stock, price: num(s.price), at: typeof s.at === "string" ? s.at : "" }] : [],
    );
    items.push({ id: r.id, sku: r.sku, name: typeof r.name === "string" ? r.name : "", price: num(r.price), low: num(r.low), total: stores.reduce((n, s) => n + s.stock, 0), stores });
  }
  return { items, total: typeof d.total === "number" ? d.total : items.length };
}

export async function getProduct(brandId: string, id: string): Promise<CatalogItem | null> {
  const [{ data: p }, { data: st }] = await Promise.all([
    db().from("catalog_products").select("id, sku, name, price, low_stock").eq("brand_id", brandId).eq("id", id).maybeSingle(),
    db().from("catalog_stock").select("store_id, stock, price, synced_at").eq("brand_id", brandId).eq("product_id", id).limit(200),
  ]);
  if (!p) return null;
  const stores = (st ?? []).map((s) => ({ storeId: s.store_id as string, stock: s.stock as number, price: num(s.price), at: s.synced_at as string }));
  return { id: p.id, sku: p.sku, name: p.name ?? "", price: num(p.price), low: num(p.low_stock), total: stores.reduce((n, s) => n + s.stock, 0), stores };
}
