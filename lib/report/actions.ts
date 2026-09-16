"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { fetchZernioMetrics, listZernioAccounts, type ZernioAccount } from "@/lib/report/zernio";
import { resolveClientZernioKey } from "@/lib/report/data";
import { CLIENT_PROVIDERS } from "@/lib/report/config";
import { getReportRules, saveReportRules, saveTemplateName, getCustomParams, saveCustomParams, saveTemplateFile } from "@/lib/report/rules";
import { analyzeReportWithClaude } from "@/lib/report/ai";
import type { ReportRule, ReportCustomParam } from "@/lib/report/types";

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

/** Validate a Zernio API key and list its connected accounts (for "Cek Koneksi"). */
export async function checkZernioConnection(
  apiKey: string,
): Promise<{ ok: boolean; accounts: ZernioAccount[]; error?: string }> {
  await requireAdmin();
  const key = (apiKey ?? "").trim();
  if (!key) return { ok: false, accounts: [], error: "Isi Zernio API key dulu." };
  return listZernioAccounts(key);
}

/* -------------------------------- admin users ------------------------------ */

/** Add/update an admin user (role + CRUD perms) from the report platform. */
export async function reportAddUser(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  if (!me.perms.create || !isSupabaseAdminConfigured()) return;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return;
  const role = String(formData.get("role") ?? "staff");
  // sensible default perms by role (owner/admin = full, staff = read+create, viewer = read)
  const preset =
    role === "owner" || role === "admin"
      ? { c: true, r: true, u: true, d: true }
      : role === "staff"
        ? { c: true, r: true, u: false, d: false }
        : { c: false, r: true, u: false, d: false };
  const db = createSupabaseAdminClient();
  await db.from("admin_users").upsert(
    {
      email,
      name: (formData.get("name") as string) || null,
      role,
      can_create: formData.get("can_create") != null ? formData.get("can_create") === "on" : preset.c,
      can_read: true,
      can_update: formData.get("can_update") != null ? formData.get("can_update") === "on" : preset.u,
      can_delete: formData.get("can_delete") != null ? formData.get("can_delete") === "on" : preset.d,
    },
    { onConflict: "email" },
  );
  revalidatePath("/report/admin/users");
}

export async function reportDeleteUser(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  if (!me.perms.delete || !isSupabaseAdminConfigured()) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const db = createSupabaseAdminClient();
  await db.from("admin_users").delete().eq("id", id);
  revalidatePath("/report/admin/users");
}

/* ------------------------------ report settings ---------------------------- */

/** Add or update a report rule (formula). */
export async function saveReportRule(formData: FormData): Promise<void> {
  await requireAdmin();
  const rules = await getReportRules();
  const id = String(formData.get("id") ?? "").trim() || randomUUID().slice(0, 8);
  const rule: ReportRule = {
    id,
    label: String(formData.get("label") ?? "").trim() || "Rule",
    metric: String(formData.get("metric") ?? "reach").trim(),
    direction: String(formData.get("direction") ?? "up") === "down" ? "down" : "up",
    thresholdPct: Number(formData.get("thresholdPct") ?? 0) || 0,
    color: String(formData.get("color") ?? "").trim() || "#6AA84F",
    note: String(formData.get("note") ?? "").trim() || undefined,
  };
  const next = rules.some((r) => r.id === id) ? rules.map((r) => (r.id === id ? rule : r)) : [...rules, rule];
  await saveReportRules(next);
  revalidatePath("/report/admin/report-settings");
}

export async function deleteReportRule(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const rules = await getReportRules();
  await saveReportRules(rules.filter((r) => r.id !== id));
  revalidatePath("/report/admin/report-settings");
}

export async function saveReportTemplate(formData: FormData): Promise<void> {
  await requireAdmin();
  await saveTemplateName(String(formData.get("template_name") ?? "").trim());
  revalidatePath("/report/admin/report-settings");
}

/** Upload the default report template file (.xlsx) — stored base64 in app_settings. */
export async function uploadReportTemplate(formData: FormData): Promise<void> {
  await requireAdmin();
  const file = formData.get("template_file");
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > 2_000_000) return; // 2MB cap
  const name = file.name || "template.xlsx";
  if (!/\.xlsx?$/i.test(name)) return;
  const buf = Buffer.from(await file.arrayBuffer());
  await saveTemplateFile(name, buf.toString("base64"));
  // switch the active template type to the uploaded file
  await saveTemplateName("uploaded");
  revalidatePath("/report/admin/report-settings");
}

/** Add/update a custom AI parameter (analyzed by Claude Opus). */
export async function saveCustomParam(formData: FormData): Promise<void> {
  await requireAdmin();
  const params = await getCustomParams();
  const id = String(formData.get("id") ?? "").trim() || randomUUID().slice(0, 8);
  const param: ReportCustomParam = {
    id,
    label: String(formData.get("label") ?? "").trim() || "Parameter",
    type: String(formData.get("type") ?? "analisa").trim(),
    prompt: String(formData.get("prompt") ?? "").trim(),
  };
  const next = params.some((p) => p.id === id) ? params.map((p) => (p.id === id ? param : p)) : [...params, param];
  await saveCustomParams(next);
  revalidatePath("/report/admin/report-settings");
}

export async function deleteCustomParam(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const params = await getCustomParams();
  await saveCustomParams(params.filter((p) => p.id !== id));
  revalidatePath("/report/admin/report-settings");
}

/** Set (or clear) the website tracked for a brand. Stored in report_client_settings. */
export async function saveClientWebsite(formData: FormData): Promise<void> {
  await requireAdmin();
  if (!isSupabaseAdminConfigured()) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  let url = String(formData.get("website") ?? "").trim();
  const db = createSupabaseAdminClient();
  if (url) {
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    await db
      .from("report_client_settings")
      .upsert({ client_id: id, key: "website", value: url, updated_at: new Date().toISOString() }, { onConflict: "client_id,key" });
  } else {
    await db.from("report_client_settings").delete().eq("client_id", id).eq("key", "website");
  }
  revalidatePath("/report/admin");
}

/**
 * Add a client. Per the flow, this only needs the client's Zernio API key +
 * Zernio profile id — the account handle/name is read FROM Zernio (best-effort
 * on create; refreshed on each report generation). An optional label can be
 * given for the list before Zernio resolves the real handle.
 */
export async function createClient(formData: FormData): Promise<void> {
  await requireAdmin();
  if (!isSupabaseAdminConfigured()) return;
  const zernioKey = String(formData.get("zernio_api_key") ?? "").trim();
  const profileId = String(formData.get("zernio_account_id") ?? "").trim();
  if (!zernioKey || !profileId) return;
  const label = String(formData.get("name") ?? "").trim();
  const brand = String(formData.get("brand_color") ?? "").trim() || "#2A2870";
  const accent = String(formData.get("accent_color") ?? "").trim() || "#38B6F0";
  const db = createSupabaseAdminClient();
  const now = new Date().toISOString();

  // Best-effort: read the handle/name from Zernio so the client appears named.
  let name = label || profileId;
  let igHandle: string | null = null;
  const metrics = await fetchZernioMetrics({ apiKey: zernioKey, accountId: profileId, period: "last_30d" });
  if (metrics.connected && metrics.account?.username) {
    igHandle = metrics.account.username;
    if (!label) name = metrics.account.username;
  }

  const slug = await uniqueSlug(slugify(name));
  const { data: inserted } = await db
    .from("report_clients")
    .insert({
      slug,
      name,
      ig_handle: igHandle,
      brand_color: brand,
      accent_color: accent,
      connect_token: randomUUID().replace(/-/g, ""),
      status: "connected",
    })
    .select("id")
    .maybeSingle();

  const clientId = inserted?.id as string | undefined;
  if (clientId) {
    await db.from("report_client_settings").upsert(
      [
        { client_id: clientId, key: "zernio", value: zernioKey, updated_at: now },
        { client_id: clientId, key: "zernio_account_id", value: profileId, updated_at: now },
      ],
      { onConflict: "client_id,key" },
    );
  }
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

/* ---------------------------- Zernio connections --------------------------- */

/**
 * Add ANOTHER Zernio connection (API key) to a client. A client can hold more
 * than one Zernio key/profile — accounts from every key show up in the picker
 * and reports auto-resolve the right key for the chosen account. Validated via
 * Zernio before saving. The first key added becomes the primary (`zernio`);
 * further keys are appended to the `zernio_keys` JSON setting.
 */
export async function addClientZernioKey(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (!isSupabaseAdminConfigured()) return { ok: false, error: "Server belum terkonfigurasi." };
  const id = String(formData.get("id") ?? "");
  const key = String(formData.get("zernio_api_key") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  if (!id || !key) return { ok: false, error: "Isi Zernio API key dulu." };

  const check = await listZernioAccounts(key);
  if (!check.ok) return { ok: false, error: check.error ?? "Koneksi Zernio gagal." };

  const db = createSupabaseAdminClient();
  const { data } = await db
    .from("report_client_settings")
    .select("key, value")
    .eq("client_id", id)
    .in("key", ["zernio", "zernio_keys"]);
  const map: Record<string, string> = {};
  for (const r of data ?? []) if (r.key && r.value) map[r.key as string] = r.value as string;
  const now = new Date().toISOString();

  if (!map.zernio?.trim()) {
    // No primary yet → this key becomes the primary connection.
    await db
      .from("report_client_settings")
      .upsert({ client_id: id, key: "zernio", value: key, updated_at: now }, { onConflict: "client_id,key" });
  } else {
    if (map.zernio.trim() === key) return { ok: false, error: "Key ini sudah jadi koneksi utama." };
    let extras: { id: string; key: string; label: string }[] = [];
    try {
      const p = JSON.parse(map.zernio_keys ?? "[]");
      if (Array.isArray(p)) extras = p;
    } catch {
      /* reset malformed */
    }
    if (extras.some((e) => e.key === key)) return { ok: false, error: "Key ini sudah ditambahkan." };
    extras.push({ id: randomUUID().slice(0, 8), key, label: label || `Zernio ${extras.length + 2}` });
    await db
      .from("report_client_settings")
      .upsert(
        { client_id: id, key: "zernio_keys", value: JSON.stringify(extras), updated_at: now },
        { onConflict: "client_id,key" },
      );
  }
  await db.from("report_clients").update({ status: "connected", updated_at: now }).eq("id", id);
  revalidatePath(`/report/admin/${id}/settings`);
  revalidatePath("/report/admin");
  return { ok: true };
}

/** Remove one Zernio connection. `conn` = "primary" (the `zernio` key) or an extra's id. */
export async function removeClientZernioKey(formData: FormData): Promise<void> {
  await requireAdmin();
  if (!isSupabaseAdminConfigured()) return;
  const id = String(formData.get("id") ?? "");
  const connId = String(formData.get("conn") ?? "");
  if (!id || !connId) return;
  const db = createSupabaseAdminClient();
  const now = new Date().toISOString();

  if (connId === "primary") {
    await db.from("report_client_settings").delete().eq("client_id", id).eq("key", "zernio");
  } else {
    const { data } = await db
      .from("report_client_settings")
      .select("value")
      .eq("client_id", id)
      .eq("key", "zernio_keys")
      .maybeSingle();
    let extras: { id: string; key: string; label: string }[] = [];
    try {
      const p = JSON.parse((data?.value as string) ?? "[]");
      if (Array.isArray(p)) extras = p;
    } catch {
      /* ignore */
    }
    extras = extras.filter((e) => e.id !== connId);
    await db
      .from("report_client_settings")
      .upsert(
        { client_id: id, key: "zernio_keys", value: JSON.stringify(extras), updated_at: now },
        { onConflict: "client_id,key" },
      );
  }
  revalidatePath(`/report/admin/${id}/settings`);
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
  if (!id) return;
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const rawSince = String(formData.get("since") ?? "").trim();
  const rawUntil = String(formData.get("until") ?? "").trim();
  const since = dateRe.test(rawSince) ? rawSince : undefined;
  const until = dateRe.test(rawUntil) ? rawUntil : undefined;
  const period = since && until ? `${since} → ${until}` : String(formData.get("period") ?? "last_30d").trim() || "last_30d";
  const db = createSupabaseAdminClient();
  const { data: keys } = await db
    .from("report_client_settings")
    .select("key, value")
    .eq("client_id", id)
    .eq("key", "zernio_account_id");
  const map: Record<string, string> = {};
  for (const r of keys ?? []) if (r.key && r.value) map[r.key as string] = r.value as string;
  // the picker passes the active account id; fall back to the stored default
  const accountId = String(formData.get("account") ?? "").trim() || map.zernio_account_id || null;
  // resolve which of the client's Zernio keys owns this account (supports >1 key)
  const apiKey = await resolveClientZernioKey(id, accountId);
  const metrics = await fetchZernioMetrics({
    apiKey,
    accountId,
    since,
    until,
    period,
  });

  // Custom AI parameters → analyzed by Claude Opus, attached to the report.
  if (metrics.connected) {
    const params = await getCustomParams();
    if (params.length) {
      const { data: ck } = await db
        .from("report_client_settings")
        .select("value")
        .eq("client_id", id)
        .eq("key", "claude")
        .maybeSingle();
      const ai = await analyzeReportWithClaude((ck?.value as string) ?? null, metrics, params);
      if (ai) metrics.aiAnalysis = ai;
    }
  }

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
