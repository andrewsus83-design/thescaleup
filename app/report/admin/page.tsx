import Link from "next/link";
import { Plus, ExternalLink, Settings2, LayoutGrid, SlidersHorizontal } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { listClients, getLatestSnapshot, getConfiguredProviders } from "@/lib/report/data";
import { CLIENT_STATUSES } from "@/lib/report/types";
import { BrandPicker } from "@/components/report/brand-picker";
import { ReportDashboard } from "@/components/report/report-dashboard";
import { AddBrandForm } from "@/components/report/add-brand-form";
import { DeleteBrandButton } from "@/components/report/delete-brand-button";
import { DateRangeForm } from "@/components/report/date-range-form";

function isoDaysAgo(base: Date, days: number) {
  return new Date(base.getTime() - days * 86400000).toISOString().slice(0, 10);
}

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

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const defSince = isoDaysAgo(now, 29);

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
        {/* setting (report template + rules) · pick / add brand — top right */}
        <div className="flex items-center gap-2">
          <Link
            href="/report/admin/report-settings"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            title="Setting template & rumus report"
          >
            <SlidersHorizontal className="h-4 w-4" /> Setting
          </Link>
          <BrandPicker brands={clients.map((c) => ({ id: c.id, name: c.name }))} selectedId={selected?.id} />
        </div>
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
              <DateRangeForm clientId={selected.id} defaultSince={defSince} defaultUntil={today} today={today} />
              <Link
                href={`/report/admin/${selected.id}/settings`}
                className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"
                title="Setting API klien"
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
              <DeleteBrandButton id={selected.id} name={selected.name} />
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
