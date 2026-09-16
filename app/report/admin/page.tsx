import Link from "next/link";
import { Plus, ExternalLink, Settings2, LayoutGrid, SlidersHorizontal, Layers } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { listClients, getLatestSnapshot, getConfiguredProviders, getClientKey, getChannelFlags, listClientAccounts } from "@/lib/report/data";
import { CLIENT_STATUSES, type ReportMetrics } from "@/lib/report/types";
import { aggregateMetrics } from "@/lib/report/aggregate";
import { ChannelPicker } from "@/components/report/channel-picker";
import { ReportDashboard } from "@/components/report/report-dashboard";
import { AddBrandForm } from "@/components/report/add-brand-form";
import { DeleteBrandButton } from "@/components/report/delete-brand-button";
import { DateRangeForm } from "@/components/report/date-range-form";
import { WebsiteCard } from "@/components/report/website-card";
import { RefreshButton } from "@/components/report/refresh-button";

function isoDaysAgo(base: Date, days: number) {
  return new Date(base.getTime() - days * 86400000).toISOString().slice(0, 10);
}

export const dynamic = "force-dynamic";

export default async function ReportAdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; accounts?: string; webs?: string; add?: string }>;
}) {
  const admin = await requireAdmin();
  const { account, accounts: accCsv, webs: websCsv, add } = await searchParams;
  const allClients = isSupabaseAdminConfigured() ? await listClients() : [];
  const has = (id: string) => allClients.some((c) => c.id === id);
  const addMode = add === "1" || allClients.length === 0;

  // Live-fetch the Zernio accounts (Instagram, TikTok, …) under each client's key.
  const flags = allClients.length ? await getChannelFlags() : {};
  const acctLists = addMode ? [] : await Promise.all(allClients.map((c) => listClientAccounts(c.id)));
  const clientAccounts = await Promise.all(
    allClients.map(async (c, i) => {
      let accounts = acctLists[i] ?? [];
      // fallback: if Zernio didn't return accounts but a key/account is stored, use it
      if (!accounts.length && flags[c.id]?.social) {
        const acc = await getClientKey(c.id, "zernio_account_id");
        if (acc) accounts = [{ id: acc, username: c.igHandle, displayName: c.name, platform: "instagram", followers: null }];
      }
      return { client: c, accounts };
    }),
  );
  const allAccounts = clientAccounts.flatMap(({ client: c, accounts }) =>
    accounts.map((a) => ({ ...a, clientId: c.id })),
  );
  const accById = new Map(allAccounts.map((a) => [a.id, a]));

  // selection: ?accounts=<accountId csv> (social) + ?webs=<clientId csv>
  let accountIds = (accCsv ?? account ?? "").split(",").map((s) => s.trim()).filter((id) => accById.has(id));
  const webIds = (websCsv ?? "").split(",").map((s) => s.trim()).filter((id) => id && has(id));
  if (!accountIds.length && !webIds.length && allAccounts[0]) accountIds = [allAccounts[0].id];

  const selectedAccounts = accountIds.map((id) => accById.get(id)!);
  const combined = selectedAccounts.length > 1;
  const primaryAcc = selectedAccounts[0] ?? null;
  const primary =
    (primaryAcc && allClients.find((c) => c.id === primaryAcc.clientId)) ??
    allClients.find((c) => c.id === webIds[0]) ??
    allClients[0] ??
    null;

  let metrics: ReportMetrics | null = null;
  let configured: string[] = [];
  if (!addMode && selectedAccounts.length) {
    if (combined) {
      const snaps = await Promise.all(selectedAccounts.map((a) => getLatestSnapshot(a.clientId, a.id)));
      metrics = aggregateMetrics(snaps.filter(Boolean).map((s) => s!.data), `Gabungan · ${selectedAccounts.length} akun`);
    } else if (primaryAcc) {
      const [snap, cfg] = await Promise.all([
        getLatestSnapshot(primaryAcc.clientId, primaryAcc.id),
        getConfiguredProviders(primaryAcc.clientId),
      ]);
      metrics = snap?.data ?? null;
      configured = cfg;
    }
  }

  // web cards: selected web channels + (single primary client, to add/see its site)
  const webCardIds = Array.from(new Set([...webIds, ...(!combined && primary ? [primary.id] : [])]));
  const webUrls = await Promise.all(webCardIds.map((id) => getClientKey(id, "website")));
  const webCards = webCardIds
    .map((id, i) => ({ client: allClients.find((c) => c.id === id)!, url: webUrls[i] }))
    .filter((w) => w.client);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const defSince = isoDaysAgo(now, 29);
  const channelList = clientAccounts.map(({ client: c, accounts }) => ({
    id: c.id,
    name: c.name,
    web: flags[c.id]?.web ?? false,
    accounts: accounts.map((a) => ({ id: a.id, platform: a.platform ?? "instagram", username: a.username })),
  }));

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      {/* header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#2A2870] text-white">
            <LayoutGrid className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#1B2A4A]">ScaleUp Reports</h1>
            <p className="text-sm text-slate-500">Report analytics per akun · {admin.email}</p>
          </div>
        </div>
        {/* top right: Setting · Tambah */}
        <div className="flex items-center gap-2">
          <Link
            href="/report/admin/report-settings"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            title="Setting template & rumus report"
          >
            <SlidersHorizontal className="h-4 w-4" /> Setting
          </Link>
          <Link
            href="/report/admin?add=1"
            className="inline-flex items-center gap-2 rounded-xl bg-[#2A2870] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#211f5c]"
          >
            <Plus className="h-4 w-4" /> Tambah
          </Link>
          {!addMode && <RefreshButton />}
        </div>
      </div>

      {!isSupabaseAdminConfigured() && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Supabase belum terkonfigurasi.
        </div>
      )}

      {addMode || !primary ? (
        <AddClientCard hasClients={allClients.length > 0} />
      ) : (
        <div className="space-y-5">
          {/* account bar — channel picker to the LEFT of the avatar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <ChannelPicker clients={channelList} accountIds={accountIds} webIds={webIds} />
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: primary.brandColor }}
              >
                {combined ? <Layers className="h-5 w-5" /> : primary.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <p className="font-bold text-[#1B2A4A]">
                  {combined ? `Gabungan · ${selectedAccounts.length} akun` : primary.name}
                </p>
                <p className="text-xs text-slate-500">
                  {combined
                    ? selectedAccounts.map((a) => (a.username ? `@${a.username}` : a.platform)).join(", ")
                    : primaryAcc
                      ? `${primaryAcc.platform ?? "social"}${primaryAcc.username ? ` · @${primaryAcc.username}` : ""}`
                      : primary.slug}
                </p>
              </div>
            </div>
            {!combined && primaryAcc && (
              <div className="flex flex-wrap items-center gap-2">
                <DateRangeForm clientId={primaryAcc.clientId} accountId={primaryAcc.id} defaultSince={defSince} defaultUntil={today} today={today} />
                <Link
                  href={`/report/admin/${primary.id}/settings`}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"
                  title="Setting API klien"
                >
                  <Settings2 className="h-4 w-4" />
                </Link>
                <Link
                  href={`/report/admin/${primary.id}`}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Kelola
                </Link>
                <Link
                  href={`/report/c/${primary.slug}`}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"
                  title="Buka laporan klien"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
                <DeleteBrandButton id={primary.id} name={primary.name} />
              </div>
            )}
          </div>

          {combined && (
            <div className="rounded-2xl border border-[#2A2870]/20 bg-[#2A2870]/5 p-3 text-sm text-[#2A2870]">
              Menampilkan <b>gabungan {selectedAccounts.length} akun</b> dari laporan terakhir tiap akun. Untuk memperbarui,
              buka tiap akun dan klik “Tarik data”.
            </div>
          )}

          {/* social report */}
          {selectedAccounts.length > 0 && (
            <>
              {!combined && !configured.includes("zernio") && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                  Zernio API key untuk akun ini belum diisi.{" "}
                  <Link href={`/report/admin/${primary.id}/settings`} className="font-semibold underline">
                    Isi di Setting
                  </Link>{" "}
                  lalu klik “Tarik data”.
                </div>
              )}
              {metrics ? (
                <ReportDashboard metrics={metrics} brandColor={primary.brandColor} accentColor={primary.accentColor} showReason />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
                  <p className="font-semibold text-slate-700">Belum ada laporan untuk {primary.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Pastikan Zernio API key &amp; Profile ID terisi, lalu klik “Tarik data”.
                  </p>
                </div>
              )}
            </>
          )}

          {/* web channels */}
          {webCards.length > 0 && (
            <div className="space-y-3">
              <p className="mt-2 text-sm font-semibold text-slate-600">Web</p>
              {webCards.map(({ client: wc, url }) => (
                <WebsiteCard key={wc.id} clientId={wc.id} website={url} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddClientCard({ hasClients }: { hasClients: boolean }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Plus className="h-4 w-4" /> Tambah Brand
        </div>
        {hasClients && (
          <Link href="/report/admin" className="text-sm text-slate-500 hover:text-slate-800">
            Kembali
          </Link>
        )}
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Masukkan Zernio API key → klik <strong>Cek Koneksi</strong> → pilih akun Instagram. Profile ID &amp;
        handle terisi otomatis dari Zernio.
      </p>
      <AddBrandForm hasClients={hasClients} />
    </div>
  );
}
