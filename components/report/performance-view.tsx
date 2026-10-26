import Link from "next/link";
import { Plus, ExternalLink, Settings2, Layers } from "lucide-react";
import type { ReportView } from "@/lib/report/view";
import { ChannelPicker } from "@/components/report/channel-picker";
import { ReportDashboard } from "@/components/report/report-dashboard";
import { AddBrandForm } from "@/components/report/add-brand-form";
import { DeleteBrandButton } from "@/components/report/delete-brand-button";
import { DateRangeForm } from "@/components/report/date-range-form";
import { WebsiteCard } from "@/components/report/website-card";

/**
 * The Report screen of report.thescaleup.xyz without its page frame: the channel bar, the dashboard and the web cards.
 * The standalone page (/report/admin) and the Chat Room (Project → Report) both render this, so they cannot drift.
 *  - `basePath`: where a channel pick navigates (`?accounts=…&webs=…`).
 *  - `embedded`: inside the Chat Room. The links to the brand's own pages open in a new tab (the Room stays put) and the
 *    delete button is left out; deleting a brand stays on the report platform.
 */
export function PerformanceView({ view, basePath, embedded = false }: { view: ReportView; basePath: string; embedded?: boolean }) {
  const { configured, clients, addMode, channelList, accountIds, webIds, selectedAccounts, combined, primaryAcc, primary, metrics, configuredProviders, webCards, today, defaultSince } = view;
  const out = embedded ? { target: "_blank", rel: "noreferrer" } : {};

  return (
    <>
      {!configured && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Supabase belum terkonfigurasi.
        </div>
      )}

      {addMode || !primary ? (
        <AddClientCard hasClients={clients.length > 0} backHref={basePath} />
      ) : (
        <div className="space-y-5">
          {/* account bar — channel picker to the LEFT of the avatar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-3">
              <ChannelPicker clients={channelList} accountIds={accountIds} webIds={webIds} basePath={basePath} />
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
                <DateRangeForm clientId={primaryAcc.clientId} accountId={primaryAcc.id} defaultSince={defaultSince} defaultUntil={today} today={today} />
                <Link
                  href={`/report/admin/${primary.id}/settings`}
                  {...out}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"
                  title="Setting API klien"
                >
                  <Settings2 className="h-4 w-4" />
                </Link>
                <Link
                  href={`/report/admin/${primary.id}`}
                  {...out}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Kelola
                </Link>
                <Link
                  href={`/report/c/${primary.slug}`}
                  {...out}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"
                  title="Buka laporan klien"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
                {!embedded && <DeleteBrandButton id={primary.id} name={primary.name} />}
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
              {!combined && !configuredProviders.includes("zernio") && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                  Zernio API key untuk akun ini belum diisi.{" "}
                  <Link href={`/report/admin/${primary.id}/settings`} {...out} className="font-semibold underline">
                    Isi di Setting
                  </Link>{" "}
                  lalu klik “Tarik data”.
                </div>
              )}
              {metrics ? (
                <ReportDashboard metrics={metrics} brandColor={primary.brandColor} accentColor={primary.accentColor} showReason showChecks />
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
    </>
  );
}

function AddClientCard({ hasClients, backHref }: { hasClients: boolean; backHref: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Plus className="h-4 w-4" /> Tambah Brand
        </div>
        {hasClients && (
          <Link href={backHref} className="text-sm text-slate-500 hover:text-slate-800">
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
