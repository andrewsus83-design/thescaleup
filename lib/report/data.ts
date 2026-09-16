import "server-only";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import type { ReportClient, ReportSnapshot, ReportMetrics } from "@/lib/report/types";
import { listZernioAccounts, type ZernioAccount } from "@/lib/report/zernio";

const COLS =
  "id, slug, name, ig_handle, logo_url, brand_color, accent_color, theme, connect_token, status, notes, created_at";

type Row = Record<string, unknown>;

function toClient(r: Row): ReportClient {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    igHandle: (r.ig_handle as string) ?? null,
    logoUrl: (r.logo_url as string) ?? null,
    brandColor: (r.brand_color as string) ?? "#2A2870",
    accentColor: (r.accent_color as string) ?? "#38B6F0",
    theme: (r.theme as string) ?? "light",
    connectToken: (r.connect_token as string) ?? null,
    status: (r.status as string) ?? "pending",
    notes: (r.notes as string) ?? null,
    createdAt: String(r.created_at ?? ""),
  };
}

function db() {
  return createSupabaseAdminClient();
}

export async function listClients(): Promise<ReportClient[]> {
  if (!isSupabaseAdminConfigured()) return [];
  try {
    const { data, error } = await db()
      .from("report_clients")
      .select(COLS)
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []).map(toClient);
  } catch {
    return [];
  }
}

export async function getClient(id: string): Promise<ReportClient | null> {
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const { data } = await db().from("report_clients").select(COLS).eq("id", id).maybeSingle();
    return data ? toClient(data) : null;
  } catch {
    return null;
  }
}

export async function getClientBySlug(slug: string): Promise<ReportClient | null> {
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const { data } = await db().from("report_clients").select(COLS).eq("slug", slug).maybeSingle();
    return data ? toClient(data) : null;
  } catch {
    return null;
  }
}

/* ------------------------------ client settings ---------------------------- */

/** Full raw settings map for a client (server-only — contains secrets). */
export async function getClientSettings(clientId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!isSupabaseAdminConfigured()) return out;
  try {
    const { data } = await db()
      .from("report_client_settings")
      .select("key, value")
      .eq("client_id", clientId);
    for (const r of data ?? []) if (r.key && r.value) out[r.key as string] = r.value as string;
  } catch {
    /* table may not exist yet */
  }
  return out;
}

/** One provider key for a client (server-only). */
export async function getClientKey(clientId: string, provider: string): Promise<string | null> {
  const s = await getClientSettings(clientId);
  return s[provider]?.trim() || null;
}

/** All Zernio social accounts (IG, TikTok, …) connected under a client's key. */
export async function listClientAccounts(clientId: string): Promise<ZernioAccount[]> {
  const key = await getClientKey(clientId, "zernio");
  if (!key) return [];
  const r = await listZernioAccounts(key);
  return r.ok ? r.accounts : [];
}

/** Which provider keys are configured (presence only — safe for the UI). */
export async function getConfiguredProviders(clientId: string): Promise<string[]> {
  const s = await getClientSettings(clientId);
  return Object.keys(s).filter((k) => s[k]?.trim());
}

/** Client ids that have a website + a zernio (social) key configured — for channel badges. */
export async function getChannelFlags(): Promise<Record<string, { web: boolean; social: boolean }>> {
  const out: Record<string, { web: boolean; social: boolean }> = {};
  if (!isSupabaseAdminConfigured()) return out;
  try {
    const { data } = await db()
      .from("report_client_settings")
      .select("client_id, key")
      .in("key", ["website", "zernio"]);
    for (const r of data ?? []) {
      const id = String(r.client_id);
      out[id] ??= { web: false, social: false };
      if (r.key === "website") out[id].web = true;
      if (r.key === "zernio") out[id].social = true;
    }
  } catch {
    /* table may not exist yet */
  }
  return out;
}

/* --------------------------------- snapshots ------------------------------- */

export async function getLatestSnapshot(clientId: string, accountId?: string): Promise<ReportSnapshot | null> {
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const run = async (mode: "account" | "legacy" | "any") => {
      let q = db()
        .from("report_snapshots")
        .select("id, client_id, period, data, source, created_at")
        .eq("client_id", clientId);
      if (mode === "account" && accountId) q = q.eq("data->account->>id", accountId);
      if (mode === "legacy") q = q.is("data->account->>id", null);
      const { data } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    };
    // prefer the account-tagged snapshot; fall back ONLY to legacy (untagged)
    // snapshots — never to a DIFFERENT account's data (so an un-pulled TikTok
    // account shows "no report yet" instead of the Instagram snapshot).
    let data = accountId ? await run("account") : await run("any");
    if (!data && accountId) data = await run("legacy");
    if (!data) return null;
    return {
      id: String(data.id),
      clientId: String(data.client_id),
      period: String(data.period),
      data: (data.data as ReportMetrics) ?? { connected: false, provider: "zernio", posts: [] },
      source: (data.source as string) ?? "zernio",
      createdAt: String(data.created_at),
    };
  } catch {
    return null;
  }
}
