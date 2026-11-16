"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "./actions";
import { atLeast } from "./permissions";
import { allow } from "./ratelimit";
import { canManageTeam } from "./rules";
import { audit } from "./session";
import { UUID, str, taskContext, type Ctx } from "./tasks/context";
import { LIMITS, cleanRows, parseStore, type ImportRow } from "./products/model";

const refresh = (slug: string) => revalidatePath(`/hub/b/${slug}`, "layout");

/** Who is asking and whether their Products access lets them change things. */
async function editContext(brandId: unknown): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const c = await taskContext(brandId, "products");
  if (!c.ok) return c;
  if (!atLeast(c.ctx.level, "edit")) return { ok: false, error: "You can see Products here but not change it." };
  return c;
}

/** Adds a store. */
export async function addStore(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const parsed = parseStore((k) => str(fd, k));
  if (!parsed.ok) return { error: parsed.error };
  if (!allow(`store-add:${ctx.user.id}`, 60)) return { error: "That is a lot of stores in an hour. Try again a bit later." };
  const { data, error } = await ctx.admin.from("catalog_stores").insert({ brand_id: ctx.brandId, ...parsed.value, created_by: ctx.user.id }).select("id").single();
  if (error) {
    if (error.code === "23505") return { error: "A store with that name already exists." };
    console.error("[products] add store failed:", error.message);
    return { error: "Could not add the store. Try again." };
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "store.create", target: data.id, meta: { kind: parsed.value.kind } });
  refresh(ctx.slug);
  return { message: `Added ${parsed.value.name}.` };
}

/** Removes a store and the stock numbers it held. The products stay. Managers only: it cannot be undone. */
export async function deleteStore(fd: FormData): Promise<void> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return;
  const { ctx } = c;
  if (!canManageTeam(ctx.actor)) return;
  const id = str(fd, "id");
  if (!UUID.test(id)) return;
  const { error } = await ctx.admin.from("catalog_stores").delete().eq("brand_id", ctx.brandId).eq("id", id);
  if (!error) await audit({ actor: ctx.user, brandId: ctx.brandId, action: "store.delete", target: id });
  refresh(ctx.slug);
}

export type ChunkResult = { ok: true; created: number; existing: number } | { ok: false; error: string };

/** One chunk of an import: the rows are checked again here, then written in one go by the database. */
export async function importChunk(input: { brandId: string; storeId: string; rows: ImportRow[] }): Promise<ChunkResult> {
  const c = await editContext(input?.brandId);
  if (!c.ok) return { ok: false, error: c.error };
  const { ctx } = c;
  if (typeof input.storeId !== "string" || !UUID.test(input.storeId)) return { ok: false, error: "Pick a store first." };
  const rows = cleanRows(input.rows);
  if (!rows) return { ok: false, error: "Some rows were not valid. Reload the page and try the file again." };
  if (!allow(`catalog-import:${ctx.user.id}`, 400)) return { ok: false, error: "That is a lot of importing in an hour. Try again a bit later." };
  const { data, error } = await ctx.admin.rpc("catalog_import_chunk", { p_brand: ctx.brandId, p_store: input.storeId, p_rows: rows });
  if (error) {
    console.error("[products] import chunk failed:", error.message);
    return { ok: false, error: error.code === "42501" ? "That store does not belong to this brand." : "Could not save these rows. Nothing from this batch was kept; try again." };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, created: Number(row?.created ?? 0), existing: Number(row?.existing ?? 0) };
}

/** Called once after the last chunk: remembers when and how much, and tells the pages to reload. */
export async function finishImport(input: { brandId: string; storeId: string; rows: number; created: number }): Promise<{ ok: boolean }> {
  const c = await editContext(input?.brandId);
  if (!c.ok) return { ok: false };
  const { ctx } = c;
  if (typeof input.storeId !== "string" || !UUID.test(input.storeId)) return { ok: false };
  const rows = Number.isInteger(input.rows) && input.rows >= 0 && input.rows <= LIMITS.rows ? input.rows : 0;
  const { error } = await ctx.admin.from("catalog_stores").update({ last_import_at: new Date().toISOString(), last_import_rows: rows }).eq("brand_id", ctx.brandId).eq("id", input.storeId);
  if (error) return { ok: false };
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "store.import", target: input.storeId, meta: { rows, created: Number.isInteger(input.created) ? input.created : 0 } });
  refresh(ctx.slug);
  return { ok: true };
}

/** Changes a product's own name, price and the stock level at which it counts as low. Stock itself comes from the stores. */
export async function saveProduct(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const id = str(fd, "id");
  if (!UUID.test(id)) return { error: "That product no longer exists." };
  const name = str(fd, "name").replace(/\s+/g, " ").trim();
  if (name.length > LIMITS.productName) return { error: `Keep the name under ${LIMITS.productName} characters.` };
  const priceRaw = str(fd, "price").trim();
  let price: number | null = null;
  if (priceRaw) {
    const n = Number(priceRaw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n >= 1e12) return { error: "The price must be a number, zero or more." };
    price = Math.round(n * 100) / 100;
  }
  const lowRaw = str(fd, "low").trim();
  let low: number | null = null;
  if (lowRaw) {
    const n = Number(lowRaw);
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000) return { error: "The low-stock level must be a whole number, zero or more." };
    low = n;
  }
  const { data, error } = await ctx.admin.from("catalog_products").update({ name, price, low_stock: low }).eq("brand_id", ctx.brandId).eq("id", id).select("id").maybeSingle();
  if (error) {
    console.error("[products] save failed:", error.message);
    return { error: "Could not save. Try again." };
  }
  if (!data) return { error: "That product no longer exists." };
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "product.update", target: id });
  refresh(ctx.slug);
  return { message: "Saved." };
}

/** Removes a product and its stock in every store. Managers only. A later import of the same SKU brings it back. */
export async function deleteProduct(fd: FormData): Promise<void> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return;
  const { ctx } = c;
  if (!canManageTeam(ctx.actor)) return;
  const id = str(fd, "id");
  if (!UUID.test(id)) return;
  const { error } = await ctx.admin.from("catalog_products").delete().eq("brand_id", ctx.brandId).eq("id", id);
  if (!error) await audit({ actor: ctx.user, brandId: ctx.brandId, action: "product.delete", target: id });
  refresh(ctx.slug);
  redirect(`/hub/b/${ctx.slug}/products`);
}
