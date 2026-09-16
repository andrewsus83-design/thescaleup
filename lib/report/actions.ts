"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { fetchZernioMetrics } from "@/lib/report/zernio";
import { CLIENT_PROVIDERS } from "@/lib/report/config";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "client"
  );
}

async function uniqueSlug(base: string): Promise<string> {
  const db = createSupabaseAdminClient();
  let slug = base;
  for (let i = 0; i < 20; i++) {
    const { data } = await db.from("report_clients").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${i + 2}`;
  }
  return `${base}-${randomUUID().slice(0, 6)}`;
}

/* --------------------------------- clients -------------------------------- */

export async function createClient(formData: FormData): Promise<void> {
  await requireAdmin();
  if (!isSupabaseAdminConfigured()) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const igHandle = String(formData.get("ig_handle") ?? "").trim().replace(/^@/, "");
  const brand = String(formData.get("brand_color") ?? "").trim() || "#2A2870";
  const accent = String(formData.get("accent_color") ?? "").trim() || "#38B6F0";
  const db = createSupabaseAdminClient();
  const slug = await uniqueSlug(slugify(name));
  await db.from("report_clients").insert({
    slug,
    name,
    ig_handle: igHandle || null,
    brand_color: brand,
    accent_color: accent,
    connect_token: randomUUID().replace(/-/g, ""),
    status: "pending",
  });
  revalidatePath("/report/admin");
}

export async function updateClient(formData: FormData): Promise<void> {
  await requireAdmin();
  if (!isSupabaseAdminConfigured()) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fields: [string, string][] = [
    ["name", "name"],
    ["ig_handle", "ig_handle"],
    ["brand_color", "brand_color"],
    ["accent_color", "accent_color"],
    ["theme", "theme"],
    ["status", "status"],
    ["notes", "notes"],
    ["logo_url", "logo_url"],
  ];
  for (const [form, col] of fields) {
    const v = formData.get(form);
    if (typeof v === "string" && v.trim() !== "") {
      patch[col] = col === "ig_handle" ? v.trim().replace(/^@/, "") : v.trim();
    }
  }
  const db = createSupabaseAdminClient();
  await db.from("report_clients").update(patch).eq("id", id);
  revalidatePath("/report/admin");
  revalidatePath(`/report/admin/${id}`);
}

export async function deleteClient(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin.perms.delete) return;
  if (!isSupabaseAdminConfigured()) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const db = createSupabaseAdminClient();
  await db.from("report_clients").delete().eq("id", id);
  revalidatePath("/report/admin");
}

/* ---------------------------- per-client settings -------------------------- */

const PROVIDER_KEYS = new Set(CLIENT_PROVIDERS.map((p) => p.key));

/** Admin saves this client's own API keys (only non-empty values are written). */
export async function saveClientSettings(formData: FormData): Promise<void> {
  await requireAdmin();
  if (!isSupabaseAdminConfigured()) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const now = new Date().toISOString();
  const rows: { client_id: string; key: string; value: string; updated_at: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "id" || !PROVIDER_KEYS.has(key)) continue;
    if (typeof value !== "string" || value.trim() === "") continue;
    rows.push({ client_id: id, key, value: value.trim(), updated_at: now });
  }
  const db = createSupabaseAdminClient();
  if (rows.length) {
    await db.from("report_client_settings").upsert(rows, { onConflict: "client_id,key" });
  }
  // If Zernio key just landed, mark the client connected.
  if (rows.some((r) => r.key === "zernio")) {
    await db.from("report_clients").update({ status: "connected", updated_at: now }).eq("id", id);
  }
  revalidatePath(`/report/admin/${id}/settings`);
  revalidatePath(`/report/admin/${id}`);
  revalidatePath("/report/admin");
}

/** Remove one provider key for a client. */
export async function clearClientSetting(formData: FormData): Promise<void> {
  await requireAdmin();
  if (!isSupabaseAdminConfigured()) return;
  const id = String(formData.get("id") ?? "");
  const key = String(formData.get("key") ?? "");
  if (!id || !key) return;
  const db = createSupabaseAdminClient();
  await db.from("report_client_settings").delete().eq("client_id", id).eq("key", key);
  revalidatePath(`/report/admin/${id}/settings`);
}

/* --------------------------------- reports -------------------------------- */

/** Generate a report snapshot for a client by pulling their Zernio data. */
export async function generateReport(formData: FormData): Promise<void> {
  await requireAdmin();
  if (!isSupabaseAdminConfigured()) return;
  const id = String(formData.get("id") ?? "");
  const period = String(formData.get("period") ?? "last_30d").trim() || "last_30d";
  if (!id) return;
  const db = createSupabaseAdminClient();
  const { data: keys } = await db
    .from("report_client_settings")
    .select("key, value")
    .eq("client_id", id)
    .in("key", ["zernio", "zernio_account_id"]);
  const map: Record<string, string> = {};
  for (const r of keys ?? []) if (r.key && r.value) map[r.key as string] = r.value as string;
  const metrics = await fetchZernioMetrics({
    apiKey: map.zernio ?? null,
    accountId: map.zernio_account_id ?? null,
    period,
  });
  await db.from("report_snapshots").insert({ client_id: id, period, data: metrics, source: "zernio" });
  if (metrics.connected) {
    await db.from("report_clients").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", id);
  }
  revalidatePath(`/report/admin/${id}`);
  revalidatePath("/report/admin");
}

/* --------------------------- client-side connect --------------------------- */

/**
 * Client connects their own Zernio account through their report link.
 * Authorized by the per-client connect_token (no admin session required).
 */
export async function connectClientZernio(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseAdminConfigured()) return { ok: false, error: "Server belum terkonfigurasi." };
  const slug = String(formData.get("slug") ?? "");
  const token = String(formData.get("token") ?? "");
  const key = String(formData.get("zernio_api_key") ?? "").trim();
  const accountId = String(formData.get("zernio_account_id") ?? "").trim();
  if (!slug || !token || !key) return { ok: false, error: "Data tidak lengkap." };
  const db = createSupabaseAdminClient();
  const { data: row } = await db
    .from("report_clients")
    .select("id, connect_token")
    .eq("slug", slug)
    .maybeSingle();
  if (!row || row.connect_token !== token) return { ok: false, error: "Link koneksi tidak valid." };
  const now = new Date().toISOString();
  const rows = [{ client_id: row.id, key: "zernio", value: key, updated_at: now }];
  if (accountId) rows.push({ client_id: row.id, key: "zernio_account_id", value: accountId, updated_at: now });
  await db.from("report_client_settings").upsert(rows, { onConflict: "client_id,key" });
  await db.from("report_clients").update({ status: "connected", updated_at: now }).eq("id", row.id);
  revalidatePath(`/report/c/${slug}`);
  return { ok: true };
}
