import Link from "next/link";
import { Plus, ExternalLink, Settings2 } from "lucide-react";
import type { ReportView } from "@/lib/report/view";
import { Alert, Card } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { ChannelPicker } from "@/components/report/channel-picker";
import { ReportDashboard } from "@/components/report/report-dashboard";
import { AddBrandForm } from "@/components/report/add-brand-form";
import { DeleteBrandButton } from "@/components/report/delete-brand-button";
import { DateRangeForm } from "@/components/report/date-range-form";
import { ReportAvatar } from "@/components/report/report-avatar";
import { WebsiteCard } from "@/components/report/website-card";

/**
 * The Report screen of report.thescaleup.xyz without its page frame: the channel bar, the dashboard and the web cards.
 * The standalone page (/report/admin) and the Chat Room (Project → Report) both render this, so they cannot drift.
 *  - `basePath`: where a channel pick navigates (`?accounts=…&webs=…`).
 *  - `embedded`: inside the Chat Room. The links to the brand's own pages open in a new tab (the Room stays put) and the
 *    delete button is left out; deleting a brand stays on the report platform.
 * Brand v2: cards are white on Paper, 24px apart; "Tarik data" is the one Orange button.
 */
export function PerformanceView({ view, basePath, embedded = false }: { view: ReportView; basePath: string; embedded?: boolean }) {
  const { configured, clients, addMode, channelList, accountIds, webIds, selectedAccounts, combined, primaryAcc, primary, metrics, configuredProviders, webCards, today, defaultSince } = view;
  const out = embedded ? { target: "_blank", rel: "noreferrer" } : {};

  return (
    <>
      {!configured && (
        <Alert tone="warn" className="mb-6">
          Supabase belum terkonfigurasi.
        </Alert>
      )}

      {addMode || !primary ? (
        <AddClientCard hasClients={clients.length > 0} backHref={basePath} />
      ) : (
        <div className="space-y-6">
          {/* account bar — channel picker to the LEFT of the avatar */}
          <Card className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <ChannelPicker clients={channelList} accountIds={accountIds} webIds={webIds} basePath={basePath} />
                <ReportAvatar name={primary.name} combined={combined} />
                <div className="min-w-0">
                  <p className="truncate font-title text-h3 text-ink-800">{combined ? `Gabungan · ${selectedAccounts.length} akun` : primary.name}</p>
                  <p className="truncate text-small text-ink-500">
                    {combined
                      ? selectedAccounts.map((a) => (a.username ? `@${a.username}` : a.platform)).join(", ")
                      : primaryAcc
                        ? `${primaryAcc.platform ?? "social"}${primaryAcc.username ? ` · @${primaryAcc.username}` : ""}`
                        : primary.slug}
                  </p>
                </div>
              </div>
              {!combined && primaryAcc && (
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/report/admin/${primary.id}/settings`} {...out} className={btnCls("secondary", "sm", "gap-2")} title="Setting API klien">
                    <Settings2 className="size-4" aria-hidden /> API klien
                  </Link>
                  <Link href={`/report/admin/${primary.id}`} {...out} className={btnCls("secondary", "sm")}>
                    Kelola
                  </Link>
                  <Link href={`/report/c/${primary.slug}`} {...out} className={btnCls("secondary", "sm", "gap-2")} title="Buka laporan klien">
                    <ExternalLink className="size-4" aria-hidden /> Laporan klien
                  </Link>
                  {!embedded && <DeleteBrandButton id={primary.id} name={primary.name} />}
                </div>
              )}
            </div>
            {!combined && primaryAcc && (
              <DateRangeForm clientId={primaryAcc.clientId} accountId={primaryAcc.id} defaultSince={defaultSince} defaultUntil={today} today={today} />
            )}
          </Card>

          {combined && (
            <Alert tone="info">
              Menampilkan <b className="font-semibold">gabungan {selectedAccounts.length} akun</b> dari laporan terakhir tiap akun. Untuk memperbarui, buka tiap akun dan klik “Tarik data”.
            </Alert>
          )}

          {/* social report */}
          {selectedAccounts.length > 0 && (
            <>
              {!combined && !configuredProviders.includes("zernio") && (
                <Alert tone="warn">
                  Zernio API key untuk akun ini belum diisi.{" "}
                  <Link href={`/report/admin/${primary.id}/settings`} {...out} className="font-semibold text-brand-700 underline underline-offset-4 hover:text-brand-600">
                    Isi di Setting
                  </Link>{" "}
                  lalu klik “Tarik data”.
                </Alert>
              )}
              {metrics ? (
                <ReportDashboard metrics={metrics} showReason showChecks />
              ) : (
                <div className="rounded-card border-control border-dashed border-ink-200 p-10 text-center">
                  <p className="font-title text-h3 text-ink-800">Belum ada laporan untuk {primary.name}</p>
                  <p className="mt-2 text-body text-ink-500">Pastikan Zernio API key &amp; Profile ID terisi, lalu klik “Tarik data”.</p>
                </div>
              )}
            </>
          )}

          {/* web channels */}
          {webCards.length > 0 && (
            <div className="space-y-4">
              <p className="font-title text-h3 text-ink-800">Web</p>
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
    <Card className="mx-auto max-w-xl">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 font-title text-h3 text-ink-800">
          <Plus className="size-5 text-ink-500" aria-hidden /> Tambah Brand
        </h2>
        {hasClients && (
          <Link href={backHref} className={btnCls("ghost", "sm")}>
            Kembali
          </Link>
        )}
      </div>
      <p className="mb-6 max-w-chat text-small text-ink-500">
        Masukkan Zernio API key → klik <strong className="font-semibold text-ink-800">Cek Koneksi</strong> → pilih akun Instagram. Profile ID &amp; handle terisi otomatis dari Zernio.
      </p>
      <AddBrandForm />
    </Card>
  );
}
