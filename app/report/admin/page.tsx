import Link from "next/link";
import { Plus, ExternalLink, Settings2, RefreshCw, LayoutGrid, ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { listClients, getLatestSnapshot, getConfiguredProviders } from "@/lib/report/data";
import { createClient, generateReport } from "@/lib/report/actions";
import { CLIENT_STATUSES } from "@/lib/report/types";
import { BrandPicker } from "@/components/report/brand-picker";
import { ReportDashboard } from "@/components/report/report-dashboard";

export const dynamic = "force-dynamic";

export default async function ReportAdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; add?: string }>;
}) {
  const admin = await requireAdmin();
  const { client, add } = await searchParams;
  const clients = isSupabaseAdminConfigured() ? await listClients() : [];

  const selected = clients.find((c) => c.id === client) ?? clients[0] ?? null;
  const addMode = add === "1" || clients.length === 0;

  const [snapshot, configured] =
    selected && !addMode
      ? await Promise.all([getLatestSnapshot(selected.id), getConfiguredProviders(selected.id)])
      : [null, [] as string[]];

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
            <p className="text-sm text-slate-500">Report analytics per brand · {admin.email}</p>
          </div>
        </div>
        {/* pick / add brand — top right */}
        <BrandPicker
          brands={clients.map((c) => ({ id: c.id, name: c.name }))}
          selectedId={selected?.id}
        />
      </div>

      {!isSupabaseAdminConfigured() && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Supabase belum terkonfigurasi.
        </div>
      )}

      {addMode ? (
        <AddClientCard hasClients={clients.length > 0} />
      ) : selected ? (
        <div className="space-y-5">
          {/* selected brand bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: selected.brandColor }}
              >
                {selected.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <p className="font-bold text-[#1B2A4A]">{selected.name}</p>
                <p className="text-xs text-slate-500">
                  {selected.igHandle ? `@${selected.igHandle}` : selected.slug}
                  {" · "}
                  <span>{(CLIENT_STATUSES[selected.status] ?? CLIENT_STATUSES.pending).label}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form action={generateReport} className="flex items-center gap-2">
                <input type="hidden" name="id" value={selected.id} />
                <select
                  name="period"
                  defaultValue="last_30d"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2A2870]"
                >
                  <option value="last_30d">30 hari</option>
                  <option value="2026-08">Agustus 2026</option>
                  <option value="2026-07">Juli 2026</option>
                  <option value="last_90d">90 hari</option>
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2A2870] px-3 py-2 text-sm font-semibold text-white hover:bg-[#211f5c]"
                >
                  <RefreshCw className="h-4 w-4" /> Tarik data
                </button>
              </form>
              <Link
                href={`/report/admin/${selected.id}/settings`}
                className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"
                title="Setting API"
              >
                <Settings2 className="h-4 w-4" />
              </Link>
              <Link
                href={`/report/admin/${selected.id}`}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Kelola
              </Link>
              <Link
                href={`/report/c/${selected.slug}`}
                className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"
                title="Buka laporan klien"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* the report itself */}
          {!configured.includes("zernio") && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              Zernio API key untuk brand ini belum diisi.{" "}
              <Link href={`/report/admin/${selected.id}/settings`} className="font-semibold underline">
                Isi di Setting
              </Link>{" "}
              lalu klik “Tarik data”.
            </div>
          )}
          {snapshot ? (
            <ReportDashboard
              metrics={snapshot.data}
              brandColor={selected.brandColor}
              accentColor={selected.accentColor}
              showReason
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
              <p className="font-semibold text-slate-700">Belum ada laporan untuk {selected.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                Pastikan Zernio API key &amp; Profile ID terisi, lalu klik “Tarik data”.
              </p>
            </div>
          )}
        </div>
      ) : (
        <AddClientCard hasClients={false} />
      )}
    </div>
  );
}

function AddClientCard({ hasClients }: { hasClients: boolean }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Plus className="h-4 w-4" /> Tambah Brand
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Cukup nama brand + API key &amp; Profile ID Zernio. Handle Instagram &amp; data lain terbaca
        otomatis dari Zernio.
      </p>
      <form action={createClient} className="grid gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Nama Brand *</span>
          <input
            name="name"
            required
            placeholder="mis. Cap Gajah"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2A2870]"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Zernio API Key *</span>
            <input
              name="zernio_api_key"
              required
              type="password"
              autoComplete="off"
              placeholder="zernio_..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs outline-none focus:border-[#2A2870]"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Zernio Profile ID *</span>
            <input
              name="zernio_account_id"
              required
              placeholder="id profil / akun di Zernio"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs outline-none focus:border-[#2A2870]"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Warna Brand</span>
            <input name="brand_color" type="color" defaultValue="#2A2870" className="h-11 w-full rounded-lg border border-slate-200 px-1" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Warna Aksen</span>
            <input name="accent_color" type="color" defaultValue="#38B6F0" className="h-11 w-full rounded-lg border border-slate-200 px-1" />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[#2A2870] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#211f5c]">
            <Plus className="h-4 w-4" /> Buat Brand
          </button>
          {hasClients && (
            <Link href="/report/admin" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
              <ArrowLeft className="h-4 w-4" /> Kembali
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
