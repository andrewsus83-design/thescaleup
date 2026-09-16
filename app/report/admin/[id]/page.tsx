import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Link2, RefreshCw, Save } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { getClient, getLatestSnapshot, getConfiguredProviders } from "@/lib/report/data";
import { updateClient, generateReport } from "@/lib/report/actions";
import { CLIENT_STATUSES } from "@/lib/report/types";
import { CopyField } from "@/components/report/copy-field";
import { ReportDashboard } from "@/components/report/report-dashboard";
import { ClientSubnav } from "@/components/report/client-subnav";

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
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <Link href="/report/admin" className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Semua klien
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: client.brandColor }}
          >
            {client.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-[#1B2A4A]">{client.name}</h1>
            <p className="text-xs text-slate-500">{client.igHandle ? `@${client.igHandle}` : client.slug}</p>
          </div>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${st.badge}`}>{st.label}</span>
      </div>

      <ClientSubnav id={id} active="overview" configuredCount={configured.length} />

      {/* connect link */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Link2 className="h-4 w-4" /> Link koneksi untuk klien
        </div>
        <p className="mb-3 text-sm text-slate-500">
          Bagikan link ini ke klien agar mereka menghubungkan akun Zernio-nya sendiri, atau isi API key-nya
          langsung di tab <strong>Setting</strong>.
        </p>
        <CopyField value={connectUrl} />
      </div>

      {/* generate report */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <RefreshCw className="h-4 w-4" /> Generate laporan (dari Zernio)
        </div>
        <form action={generateReport} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={id} />
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Periode</span>
            <select
              name="period"
              defaultValue="last_30d"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2A2870]"
            >
              <option value="last_30d">30 hari terakhir</option>
              <option value="2026-08">Agustus 2026</option>
              <option value="2026-07">Juli 2026</option>
              <option value="last_90d">90 hari terakhir</option>
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-[#2A2870] px-4 py-2 text-sm font-semibold text-white hover:bg-[#211f5c]"
          >
            <RefreshCw className="h-4 w-4" /> Tarik data
          </button>
          {!configured.includes("zernio") && (
            <span className="text-xs text-amber-600">Zernio API key belum diisi (tab Setting).</span>
          )}
        </form>
      </div>

      {/* latest snapshot */}
      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-slate-600">
          Laporan terakhir{snapshot ? ` · ${snapshot.period}` : ""}
        </p>
        {snapshot ? (
          <ReportDashboard
            metrics={snapshot.data}
            brandColor={client.brandColor}
            accentColor={client.accentColor}
            showReason
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">
            Belum ada laporan. Isi Zernio API key di tab Setting lalu klik “Tarik data”.
          </div>
        )}
      </div>

      {/* profile edit */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Save className="h-4 w-4" /> Profil & brand
        </div>
        <form action={updateClient} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={id} />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Nama</span>
            <input name="name" defaultValue={client.name} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#2A2870]" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Instagram Handle</span>
            <input name="ig_handle" defaultValue={client.igHandle ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#2A2870]" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Brand</span>
              <input name="brand_color" type="color" defaultValue={client.brandColor} className="h-11 w-full rounded-lg border border-slate-200 px-1" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Aksen</span>
              <input name="accent_color" type="color" defaultValue={client.accentColor} className="h-11 w-full rounded-lg border border-slate-200 px-1" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Status</span>
            <select name="status" defaultValue={client.status} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#2A2870]">
              {Object.entries(CLIENT_STATUSES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Catatan</span>
            <textarea name="notes" defaultValue={client.notes ?? ""} rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#2A2870]" />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[#2A2870] px-4 py-2 text-sm font-semibold text-white hover:bg-[#211f5c]">
              <Save className="h-4 w-4" /> Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
