import "server-only";
// What the Report screens need to render, loaded once per request. Shared by the standalone report platform
// (/report/admin, /report/admin/analytic → report.thescaleup.xyz) and by the Chat Room (Project → Report), so both
// show exactly the same channels, snapshot and numbers: one loader, two frames.

import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { aggregateMetrics } from "@/lib/report/aggregate";
import { getChannelFlags, getClientKey, getConfiguredProviders, getLatestSnapshot, listClientAccounts, listClients } from "@/lib/report/data";
import type { ReportClient, ReportMetrics } from "@/lib/report/types";
import type { ZernioAccount } from "@/lib/report/zernio";

/** The URL state of a report screen: `?accounts=<Zernio account ids>&webs=<client ids>` (`account` is the old single form). */
export type ReportSearch = { account?: string; accounts?: string; webs?: string; add?: string };

export type ChannelClient = { id: string; name: string; web: boolean; accounts: { id: string; platform: string; username: string | null }[] };
type AccountOfClient = ZernioAccount & { clientId: string };

export type ReportView = {
  configured: boolean;
  clients: ReportClient[];
  /** Add-brand form instead of a report (`?add=1`, or no brand exists yet). */
  addMode: boolean;
  channelList: ChannelClient[];
  accountIds: string[];
  webIds: string[];
  selectedAccounts: AccountOfClient[];
  combined: boolean;
  primaryAcc: AccountOfClient | null;
  primary: ReportClient | null;
  /** The latest stored report for the selected account(s); null when none was pulled yet. */
  metrics: ReportMetrics | null;
  /** Provider keys the primary account's brand has filled in (names only, never values). */
  configuredProviders: string[];
  webCards: { client: ReportClient; url: string | null }[];
  /** Server "today" (UTC, YYYY-MM-DD) and the default start of the date range (29 days earlier). */
  today: string;
  defaultSince: string;
};

const isoDaysAgo = (base: Date, days: number) => new Date(base.getTime() - days * 86400000).toISOString().slice(0, 10);
const csv = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/**
 * Resolve the selection and load the report for it.
 *  - `report`   → the Report screen: with only web channels ticked there is no social report.
 *  - `analytic` → the Analytic screen: always has an account to analyse, even if only a web channel is ticked.
 */
export async function loadReportView(search: ReportSearch, mode: "report" | "analytic" = "report"): Promise<ReportView> {
  const configured = isSupabaseAdminConfigured();
  const clients = configured ? await listClients() : [];
  const has = (id: string) => clients.some((c) => c.id === id);
  const addMode = mode === "report" && (search.add === "1" || clients.length === 0);

  // Live-fetch the Zernio accounts (Instagram, TikTok, …) under each client's key.
  const flags = clients.length ? await getChannelFlags() : {};
  const acctLists = addMode ? [] : await Promise.all(clients.map((c) => listClientAccounts(c.id)));
  const clientAccounts = await Promise.all(
    clients.map(async (c, i) => {
      let accounts = acctLists[i] ?? [];
      // fallback: if Zernio didn't return accounts but a key/account is stored, use it
      if (!accounts.length && flags[c.id]?.social) {
        const acc = await getClientKey(c.id, "zernio_account_id");
        if (acc) accounts = [{ id: acc, username: c.igHandle, displayName: c.name, platform: "instagram", followers: null }];
      }
      return { client: c, accounts };
    }),
  );
  const allAccounts: AccountOfClient[] = clientAccounts.flatMap(({ client: c, accounts }) => accounts.map((a) => ({ ...a, clientId: c.id })));
  const accById = new Map(allAccounts.map((a) => [a.id, a]));

  let accountIds = csv(search.accounts ?? search.account).filter((id) => accById.has(id));
  const webIds = csv(search.webs).filter(has);
  if (!accountIds.length && (mode === "analytic" || !webIds.length) && allAccounts[0]) accountIds = [allAccounts[0].id];

  const selectedAccounts = accountIds.map((id) => accById.get(id)!);
  const combined = selectedAccounts.length > 1;
  const primaryAcc = selectedAccounts[0] ?? null;
  const primary =
    (primaryAcc && clients.find((c) => c.id === primaryAcc.clientId)) ??
    clients.find((c) => c.id === webIds[0]) ??
    clients[0] ??
    null;

  let metrics: ReportMetrics | null = null;
  let configuredProviders: string[] = [];
  if (!addMode && selectedAccounts.length) {
    if (combined) {
      const snaps = await Promise.all(selectedAccounts.map((a) => getLatestSnapshot(a.clientId, a.id, a.platform !== "tiktok")));
      metrics = aggregateMetrics(snaps.filter(Boolean).map((s) => s!.data), `Gabungan · ${selectedAccounts.length} akun`);
    } else if (primaryAcc) {
      const [snap, cfg] = await Promise.all([
        getLatestSnapshot(primaryAcc.clientId, primaryAcc.id, primaryAcc.platform !== "tiktok"),
        mode === "report" ? getConfiguredProviders(primaryAcc.clientId) : Promise.resolve([] as string[]),
      ]);
      metrics = snap?.data ?? null;
      configuredProviders = cfg;
    }
  }

  // web cards: the ticked web channels + (single primary client, to add/see its site)
  const webCardIds = mode === "report" ? Array.from(new Set([...webIds, ...(!combined && primary ? [primary.id] : [])])) : [];
  const webUrls = await Promise.all(webCardIds.map((id) => getClientKey(id, "website")));
  const webCards = webCardIds.map((id, i) => ({ client: clients.find((c) => c.id === id)!, url: webUrls[i] })).filter((w) => w.client);

  const now = new Date();
  return {
    configured,
    clients,
    addMode,
    channelList: clientAccounts.map(({ client: c, accounts }) => ({
      id: c.id,
      name: c.name,
      web: flags[c.id]?.web ?? false,
      accounts: accounts.map((a) => ({ id: a.id, platform: a.platform ?? "instagram", username: a.username })),
    })),
    accountIds,
    webIds,
    selectedAccounts,
    combined,
    primaryAcc,
    primary,
    metrics,
    configuredProviders,
    webCards,
    today: now.toISOString().slice(0, 10),
    defaultSince: isoDaysAgo(now, 29),
  };
}
