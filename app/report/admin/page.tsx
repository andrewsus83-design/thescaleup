import Link from "next/link";
import { Plus, ExternalLink, Settings2, LayoutGrid, SlidersHorizontal, Layers } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { listClients, getLatestSnapshot, getConfiguredProviders, getClientKey, getChannelFlags } from "@/lib/report/data";
import { CLIENT_STATUSES, type ReportMetrics } from "@/lib/report/types";
import { aggregateMetrics } from "@/lib/report/aggregate";
import { ChannelPicker } from "@/components/report/channel-picker";
import { ReportDashboard } from "@/components/report/report-dashboard";
import { AddBrandForm } from "@/components/report/add-brand-form";
import { DeleteBrandButton } from "@/components/report/delete-brand-button";
import { DateRangeForm } from "@/components/report/date-range-form";
import { WebsiteCard } from "@/components/report/website-card";

function isoDaysAgo(base: Date, days: number) {
  return new Date(base.getTime() - days * 86400000).toISOString().slice(0, 10);
}

export const dynamic = "force-dynamic";

export default async function ReportAdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; clients?: string; webs?: string; add?: string }>;
}) {
  const admin = await requireAdmin();
  const { client, clients: clientsCsv, webs: websCsv, add } = await searchParams;
  const allClients = isSupabaseAdminConfigured() ? await listClients() : [];
  const has = (id: string) => allClients.some((c) => c.id === id);
  const parse = (csv?: string) => (csv ?? "").split(",").map((s) => s.trim()).filter((id) => id && has(id));

  // channel selection: social channels (?clients) + web channels (?webs)
  let socialIds = parse(clientsCsv);
  if (!socialIds.length && client && has(client)) socialIds = [client];
  const webIds = parse(websCsv);
  // default to the first client's social when nothing is selected at all
  if (!socialIds.length && !webIds.length && allClients[0]) socialIds = [allClients[0].id];

  const socialClients = socialIds.map((id) => allClients.find((c) => c.id === id)!);
  const combined = socialClients.length > 1;
  const primary = socialClients[0] ?? allClients.find((c) => c.id === webIds[0]) ?? null;
  const addMode = add === "1" || allClients.length === 0;

  const flags = allClients.length ? await getChannelFlags() : {};

  let metrics: ReportMetrics | null = null;
  let configured: string[] = [];
  if (!addMode && socialClients.length) {
    if (combined) {
      const snaps = await Promise.all(socialClients.map((c) => getLatestSnapshot(c.id)));
      metrics = aggregateMetrics(snaps.filter(Boolean).map((s) => s!.data), `Gabungan · ${socialClients.length} akun`);
    } else {
      const [snap, cfg] = await Promise.all([getLatestSnapshot(primary!.id), getConfiguredProviders(primary!.id)]);
      metrics = snap?.data ?? null;
      configured = cfg;
    }
  }

  // web cards: selected web channels + (single-social primary, to add/see its site)
  const webCardIds = Array.from(
    new Set([...webIds, ...(!combined && primary && flags[primary.id]?.social ? [primary.id] : [])]),
  );
  const webUrls = await Promise.all(webCardIds.map((id) => getClientKey(id, "website")));
  const webCards = webCardIds.map((id, i) => ({ client: allClients.find((c) => c.id === id)!, url: webUrls[i] }));

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const defSince = isoDaysAgo(now, 29);
  const channelList = allClients.map((c) => ({
    id: c.id,
    name: c.name,
    handle: c.igHandle,
    web: flags[c.id]?.web ?? false,
    social: flags[c.id]?.social ?? false,
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
              <ChannelPicker clients={channelList} socialIds={socialIds} webIds={webIds} />
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: primary.brandColor }}
              >
                {combined ? <Layers className="h-5 w-5" /> : primary.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <p className="font-bold text-[#1B2A4A]">
                  {combined ? `Gabungan · ${socialClients.length} akun` : primary.name}
                </p>
                <p className="text-xs text-slate-500">
                  {combined
                    ? socialClients.map((c) => c.name).join(", ")
                    : primary.igHandle
                      ? `@${primary.igHandle} · ${(CLIENT_STATUSES[primary.status] ?? CLIENT_STATUSES.pending).label}`
                      : primary.slug}
                </p>
              </div>
            </div>
            {!combined && socialClients.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <DateRangeForm clientId={primary.id} defaultSince={defSince} defaultUntil={today} today={today} />
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
              Menampilkan <b>gabungan {socialClients.length} akun</b> dari laporan terakhir tiap akun. Untuk memperbarui,
              buka tiap akun dan klik “Tarik data”.
            </div>
          )}

          {/* social report */}
          {socialClients.length > 0 && (
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
