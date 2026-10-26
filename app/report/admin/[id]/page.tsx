import { notFound } from "next/navigation";
import { Link2, RefreshCw, Save } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { getClient, getLatestSnapshot, getConfiguredProviders } from "@/lib/report/data";
import { updateClient, generateReport } from "@/lib/report/actions";
import { CLIENT_STATUSES } from "@/lib/report/types";
import { Card, Chip } from "@/components/brand/primitives";
import { btnCls, capsCls, inputCls, labelCls, pageX, textareaCls } from "@/components/brand/styles";
import { cn } from "@/lib/utils";
import { CopyField } from "@/components/report/copy-field";
import { ReportDashboard } from "@/components/report/report-dashboard";
import { ClientSubnav } from "@/components/report/client-subnav";
import { ReportAvatar } from "@/components/report/report-avatar";
import { ReportPageHead } from "@/components/report/page-head";

export const dynamic = "force-dynamic";

const REPORT_BASE = process.env.NEXT_PUBLIC_REPORT_URL ?? "https://report.thescaleup.xyz";

export default async function ClientOverview({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const [snapshot, configured] = await Promise.all([
    getLatestSnapshot(id),
    getConfiguredProviders(id),
  ]);
  const st = CLIENT_STATUSES[client.status] ?? CLIENT_STATUSES.pending;
  const connectUrl = client.connectToken
    ? `${REPORT_BASE}/c/${client.slug}?t=${client.connectToken}`
    : `${REPORT_BASE}/c/${client.slug}`;

  return (
    <div className={cn("mx-auto max-w-5xl py-10 sm:py-12", pageX)}>
      <ReportPageHead
        back={{ href: "/report/admin", label: "Semua klien" }}
        title={client.name}
        description={client.igHandle ? `@${client.igHandle}` : client.slug}
        lead={<ReportAvatar name={client.name} size="lg" />}
        trailing={<Chip tone={st.tone}>{st.label}</Chip>}
      />

      <ClientSubnav id={id} active="overview" configuredCount={configured.length} />

      <div className="mt-8 space-y-6">
        {/* connect link */}
        <Card>
          <h2 className="mb-3 flex items-center gap-3 font-title text-h3 text-ink-800">
            <Link2 className="size-5 text-ink-500" aria-hidden /> Link koneksi untuk klien
          </h2>
          <p className="mb-6 max-w-chat text-small text-ink-500">
            Bagikan link ini ke klien agar mereka menghubungkan akun Zernio-nya sendiri, atau isi API key-nya langsung di tab <strong className="font-semibold text-ink-800">Setting</strong>.
          </p>
          <CopyField value={connectUrl} />
        </Card>

        {/* generate report */}
        <Card>
          <h2 className="mb-6 flex items-center gap-3 font-title text-h3 text-ink-800">
            <RefreshCw className="size-5 text-ink-500" aria-hidden /> Generate laporan (dari Zernio)
          </h2>
          <form action={generateReport} className="flex flex-wrap items-end gap-x-4 gap-y-4">
            <input type="hidden" name="id" value={id} />
            <label className="block">
              <span className={labelCls}>Periode</span>
              <select name="period" defaultValue="last_30d" className={cn(inputCls, "w-64")}>
                <option value="last_30d">30 hari terakhir</option>
                <option value="2026-08">Agustus 2026</option>
                <option value="2026-07">Juli 2026</option>
                <option value="last_90d">90 hari terakhir</option>
              </select>
            </label>
            <button type="submit" className={cn(btnCls("primary", "lg", "gap-2"), "mb-1")}>
              <RefreshCw className="size-4" aria-hidden /> Tarik data
            </button>
            {!configured.includes("zernio") && <span className="mb-4 text-small text-ink-500">Zernio API key belum diisi (tab Setting).</span>}
          </form>
        </Card>

        {/* latest snapshot */}
        <div>
          <p className={cn(capsCls, "mb-4")}>Laporan terakhir{snapshot ? ` · ${snapshot.period}` : ""}</p>
          {snapshot ? (
            <ReportDashboard metrics={snapshot.data} showReason showChecks />
          ) : (
            <div className="rounded-card border-control border-dashed border-ink-200 p-10 text-center text-body text-ink-500">
              Belum ada laporan. Isi Zernio API key di tab Setting lalu klik “Tarik data”.
            </div>
          )}
        </div>

        {/* profile edit */}
        <Card>
          <h2 className="mb-6 flex items-center gap-3 font-title text-h3 text-ink-800">
            <Save className="size-5 text-ink-500" aria-hidden /> Profil
          </h2>
          <form action={updateClient} className="grid gap-6 sm:grid-cols-2">
            <input type="hidden" name="id" value={id} />
            <label className="block">
              <span className={labelCls}>Nama</span>
              <input name="name" defaultValue={client.name} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Instagram Handle</span>
              <input name="ig_handle" defaultValue={client.igHandle ?? ""} className={inputCls} />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelCls}>Status</span>
              <select name="status" defaultValue={client.status} className={inputCls}>
                {Object.entries(CLIENT_STATUSES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className={labelCls}>Catatan</span>
              <textarea name="notes" defaultValue={client.notes ?? ""} rows={2} className={textareaCls} />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className={btnCls("dark", "lg", "gap-2")}>
                <Save className="size-4" aria-hidden /> Simpan
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
