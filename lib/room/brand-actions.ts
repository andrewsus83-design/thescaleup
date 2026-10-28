"use server";
// Brand (report_clients) and per-brand API key (report_client_settings) persistence for Room.
// Each brand created via the guided intake is saved here and loaded on startup.
// Per-brand keys override workspace keys when the audit engine resolves providers.

import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { encryptValue, decryptValue } from "@/lib/room/crypto";
import type { OwnKey, ProviderId } from "@/components/room/projects/brand-keys";
import type { Project } from "@/lib/room/types";

function db() {
  return createSupabaseAdminClient();
}

// ── Brand CRUD ────────────────────────────────────────────────────────────────

/** Upsert a project into report_clients. Returns the UUID (dbId) for the brand. */
export async function createBrand(project: Project): Promise<string | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const slug = project.id;
  const { data, error } = await db()
    .from("report_clients")
    .upsert(
      {
        slug,
        name: project.name,
        ig_handle: project.profile.handles?.[0]?.replace(/^@/, "") ?? null,
        status: project.status === "active" ? "active" : "pending",
        notes: JSON.stringify({ profile: project.profile, sources: project.sources, locked: project.locked, profileVersion: project.profileVersion }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    )
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[createBrand] upsert failed:", error.message);
    return null;
  }
  return data?.id ?? null;
}

/** Load all brands from report_clients, returning them as Room Project objects. */
export async function loadBrands(): Promise<Project[]> {
  if (!isSupabaseAdminConfigured()) return [];
  const { data, error } = await db()
    .from("report_clients")
    .select("id, slug, name, ig_handle, status, notes, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[loadBrands] query failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    let profile: Project["profile"] = { brand: row.name };
    let sources: Project["sources"] = {};
    try {
      const parsed = JSON.parse(row.notes ?? "{}") as { profile?: Project["profile"]; sources?: Project["sources"] };
      if (parsed.profile) profile = parsed.profile;
      if (parsed.sources) sources = parsed.sources;
    } catch {
      /* ignore parse errors */
    }
    let locked = false;
    let profileVersion: number | null = null;
    try {
      const parsed2 = JSON.parse(row.notes ?? "{}") as { locked?: boolean; profileVersion?: number };
      locked = parsed2.locked === true;
      profileVersion = typeof parsed2.profileVersion === "number" ? parsed2.profileVersion : null;
    } catch { /* ignore */ }
    return {
      id: row.slug as string,
      dbId: row.id as string,
      name: row.name as string,
      website: (profile.website as string | undefined) ?? "",
      status: (row.status === "active" ? "active" : "draft") as "active" | "draft",
      profile,
      sources,
      locked,
      profileVersion,
      score: null,
      lastActivity: row.updated_at as string,
    } satisfies Project;
  });
}

// ── Per-brand API keys ────────────────────────────────────────────────────────

/** Save an API key for a specific brand (report_client_settings). Value is encrypted; meta is plain JSON. */
export async function saveBrandKey(
  dbId: string,
  providerId: ProviderId,
  fullKey: string,
  meta: OwnKey,
): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  const now = new Date().toISOString();
  const { error } = await db()
    .from("report_client_settings")
    .upsert(
      [
        { client_id: dbId, key: String(providerId), value: encryptValue(fullKey), updated_at: now },
        { client_id: dbId, key: `meta:${providerId}`, value: JSON.stringify(meta), updated_at: now },
      ],
      { onConflict: "client_id,key" },
    );
  if (error) {
    console.error("[saveBrandKey] upsert failed:", error.message);
    throw new Error(`Failed to save brand key for ${providerId}: ${error.message}`);
  }
}

/** Load the UI metadata (last4, cap, active) for all providers of a brand. Does NOT return secret values. */
export async function loadBrandKeys(dbId: string): Promise<Partial<Record<ProviderId, OwnKey>>> {
  if (!isSupabaseAdminConfigured()) return {};
  const { data } = await db()
    .from("report_client_settings")
    .select("key, value")
    .eq("client_id", dbId)
    .like("key", "meta:%");

  const keys: Partial<Record<ProviderId, OwnKey>> = {};
  for (const row of data ?? []) {
    const pid = (row.key as string).replace("meta:", "") as ProviderId;
    try {
      keys[pid] = JSON.parse(row.value as string) as OwnKey;
    } catch {
      /* skip */
    }
  }
  return keys;
}

/** Update UI metadata for one provider without touching the secret key value. */
export async function updateBrandKeyMeta(
  dbId: string,
  providerId: ProviderId,
  patch: Partial<OwnKey>,
): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  const metaKey = `meta:${providerId}`;
  const { data } = await db()
    .from("report_client_settings")
    .select("value")
    .eq("client_id", dbId)
    .eq("key", metaKey)
    .maybeSingle();
  const current: OwnKey = data ? (JSON.parse((data.value as string) ?? "{}") as OwnKey) : { last4: "", cap: 0, active: true };
  const { error } = await db()
    .from("report_client_settings")
    .upsert(
      { client_id: dbId, key: metaKey, value: JSON.stringify({ ...current, ...patch }), updated_at: new Date().toISOString() },
      { onConflict: "client_id,key" },
    );
  if (error) console.error("[updateBrandKeyMeta] upsert failed:", error.message);
}

/** Remove a provider's key and its metadata for a brand. */
export async function removeBrandKey(dbId: string, providerId: ProviderId): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  await db()
    .from("report_client_settings")
    .delete()
    .eq("client_id", dbId)
    .in("key", [String(providerId), `meta:${providerId}`]);
}

/** Read all decrypted API keys for a brand (used by the audit engine). */
export async function getBrandApiKeys(dbId: string): Promise<Partial<Record<string, string>>> {
  if (!isSupabaseAdminConfigured()) return {};
  const { data } = await db()
    .from("report_client_settings")
    .select("key, value")
    .eq("client_id", dbId)
    .not("key", "like", "meta:%");

  const result: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.key && row.value) result[row.key as string] = decryptValue(row.value as string);
  }
  return result;
}
