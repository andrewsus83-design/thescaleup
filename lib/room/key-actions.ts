"use server";
// Workspace API key persistence for the Room (Setting → API keys).
// Actual key values live in app_settings under their provider id (e.g. "claude", "openai").
// UI metadata (last4, cap, active, login) lives under "room_meta:{providerId}" so the UI
// can show key status without ever receiving the secret back.

import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { encryptValue } from "@/lib/room/crypto";
import type { OwnKey, ProviderId } from "@/components/room/projects/brand-keys";

export async function loadRoomKeys(): Promise<Partial<Record<ProviderId, OwnKey>>> {
  if (!isSupabaseAdminConfigured()) return {};
  try {
    const db = createSupabaseAdminClient();
    const { data } = await db.from("app_settings").select("key, value").like("key", "room_meta:%");
    const keys: Partial<Record<ProviderId, OwnKey>> = {};
    for (const row of data ?? []) {
      const pid = row.key.replace("room_meta:", "") as ProviderId;
      try {
        keys[pid] = JSON.parse(row.value ?? "{}") as OwnKey;
      } catch {
        /* skip bad rows */
      }
    }
    return keys;
  } catch {
    return {};
  }
}

export async function saveRoomKey(providerId: ProviderId, fullKey: string, meta: OwnKey): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  const db = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await db.from("app_settings").upsert(
    [
      { key: String(providerId), value: encryptValue(fullKey), updated_at: now },
      { key: `room_meta:${providerId}`, value: JSON.stringify(meta), updated_at: now },
    ],
    { onConflict: "key" },
  );
  if (error) {
    console.error("[saveRoomKey] upsert failed:", error.message, error.details);
    throw new Error(`Failed to save key for ${providerId}: ${error.message}`);
  }
}

export async function updateRoomKeyMeta(providerId: ProviderId, patch: Partial<OwnKey>): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  const db = createSupabaseAdminClient();
  const metaKey = `room_meta:${providerId}`;
  const { data } = await db.from("app_settings").select("value").eq("key", metaKey).maybeSingle();
  const current: OwnKey = data ? (JSON.parse(data.value ?? "{}") as OwnKey) : { last4: "", cap: 0, active: true };
  const { error } = await db.from("app_settings").upsert(
    { key: metaKey, value: JSON.stringify({ ...current, ...patch }), updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (error) console.error("[updateRoomKeyMeta] upsert failed:", error.message);
}

export async function removeRoomKey(providerId: ProviderId): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  const db = createSupabaseAdminClient();
  await db.from("app_settings").delete().eq("key", String(providerId));
  await db.from("app_settings").delete().eq("key", `room_meta:${providerId}`);
}

// ── Workspace cost profile ─────────────────────────────────────────────────────

export type CostProfile = {
  budget: string;
  alert: string;
  chatCap: string;
  markup: string;
  hardStop: boolean;
};

const COST_KEY = "workspace_cost_profile";
const DEFAULT_COST: CostProfile = { budget: "3.00", alert: "80", chatCap: "40", markup: "30", hardStop: true };

export async function loadWorkspaceCostProfile(): Promise<CostProfile> {
  if (!isSupabaseAdminConfigured()) return DEFAULT_COST;
  try {
    const db = createSupabaseAdminClient();
    const { data } = await db.from("app_settings").select("value").eq("key", COST_KEY).maybeSingle();
    if (!data?.value) return DEFAULT_COST;
    return { ...DEFAULT_COST, ...(JSON.parse(data.value) as Partial<CostProfile>) };
  } catch {
    return DEFAULT_COST;
  }
}

export async function saveWorkspaceCostProfile(profile: CostProfile): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  const db = createSupabaseAdminClient();
  const { error } = await db.from("app_settings").upsert(
    { key: COST_KEY, value: JSON.stringify(profile), updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (error) {
    console.error("[saveWorkspaceCostProfile] failed:", error.message);
    throw new Error("Failed to save cost profile");
  }
}
