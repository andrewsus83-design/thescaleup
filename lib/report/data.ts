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

/* ------------------------------ Zernio connections -------------------------- */

/** One Zernio connection (API key) belonging to a client. `id` "primary" = the
 *  legacy `zernio` key; extras live in the `zernio_keys` JSON setting. */
export type ZernioConn = { id: string; key: string; label: string };

/** All Zernio connections for a client — primary (`zernio`) + extras (`zernio_keys`). */
export async function getClientZernioKeys(clientId: string): Promise<ZernioConn[]> {
  const s = await getClientSettings(clientId);
  return zernioKeysFromSettings(s);
}

/** Parse the merged Zernio connection list from an already-loaded settings map. */
export function zernioKeysFromSettings(s: Record<string, string>): ZernioConn[] {
  const conns: ZernioConn[] = [];
  const primary = s.zernio?.trim();
  if (primary) conns.push({ id: "primary", key: primary, label: "Zernio 1" });
  const rawExtra = s.zernio_keys?.trim();
  if (rawExtra) {
    try {
      const arr = JSON.parse(rawExtra) as { id?: string; key?: string; label?: string }[];
      for (const e of Array.isArray(arr) ? arr : []) {
        const key = (e.key ?? "").trim();
        if (!key || conns.some((c) => c.key === key)) continue;
        conns.push({
          id: String(e.id ?? key.slice(-6)),
          key,
          label: (e.label ?? "").trim() || `Zernio ${conns.length + 1}`,
        });
      }
    } catch {
      /* malformed → ignore extras */
    }
  }
  return conns;
}

/** All Zernio social accounts (IG, TikTok, …) across ALL of a client's connections. */
export async function listClientAccounts(clientId: string): Promise<ZernioAccount[]> {
  const conns = await getClientZernioKeys(clientId);
  if (!conns.length) return [];
  const lists = await Promise.all(conns.map((c) => listZernioAccounts(c.key)));
  const seen = new Set<string>();
  const out: ZernioAccount[] = [];
  lists.forEach((r, i) => {
    if (!r.ok) return;
    for (const a of r.accounts) {
      if (!a.id || seen.has(a.id)) continue;
      seen.add(a.id);
      out.push({ ...a, keyId: conns[i].id });
    }
  });
  return out;
}

/** Which Zernio API key owns a given social account (across every connection). */
export async function resolveClientZernioKey(clientId: string, accountId: string | null): Promise<string | null> {
  const conns = await getClientZernioKeys(clientId);
  if (!conns.length) return null;
  if (!accountId) return conns[0].key;
  const lists = await Promise.all(conns.map((c) => listZernioAccounts(c.key)));
  for (let i = 0; i < conns.length; i++) {
    if (lists[i].ok && lists[i].accounts.some((a) => a.id === accountId)) return conns[i].key;
  }
  return conns[0].key; // fall back to the primary key
}

/** Safe (masked) metadata for each Zernio connection, with its live accounts — for the settings UI. */
export type ZernioConnMeta = {
  id: string;
  label: string;
  masked: string;
  ok: boolean;
  error?: string;
  accounts: ZernioAccount[];
};

export async function getClientZernioConnMeta(clientId: string): Promise<ZernioConnMeta[]> {
  const conns = await getClientZernioKeys(clientId);
  if (!conns.length) return [];
  const lists = await Promise.all(conns.map((c) => listZernioAccounts(c.key)));
  return conns.map((c, i) => ({
    id: c.id,
    label: c.label,
    masked: c.key.length <= 6 ? "••••" : "••••" + c.key.slice(-4),
    ok: lists[i].ok,
    error: lists[i].error,
    accounts: lists[i].ok ? lists[i].accounts : [],
  }));
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
      .in("key", ["website", "zernio", "zernio_keys"]);
    for (const r of data ?? []) {
      const id = String(r.client_id);
      out[id] ??= { web: false, social: false };
      if (r.key === "website") out[id].web = true;
      if (r.key === "zernio" || r.key === "zernio_keys") out[id].social = true;
    }
  } catch {
    /* table may not exist yet */
  }
  return out;
}

/* --------------------------------- snapshots ------------------------------- */

export async function getLatestSnapshot(
  clientId: string,
  accountId?: string,
  allowLegacy = true,
): Promise<ReportSnapshot | null> {
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
    // prefer the account-tagged snapshot; fall back to legacy (untagged) ONLY
    // when allowed — legacy snapshots are all Instagram (pre-account-tagging),
    // so TikTok must NOT fall back to them (would show IG data).
    let data = accountId ? await run("account") : await run("any");
    if (!data && accountId && allowLegacy) data = await run("legacy");
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
