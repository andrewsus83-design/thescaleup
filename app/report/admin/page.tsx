import Link from "next/link";
import { Plus, Users, ExternalLink, Settings2, LayoutGrid } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { listClients } from "@/lib/report/data";
import { createClient } from "@/lib/report/actions";
import { CLIENT_STATUSES } from "@/lib/report/types";

export const dynamic = "force-dynamic";

export default async function ReportAdminDashboard() {
  const admin = await requireAdmin();
  const clients = isSupabaseAdminConfigured() ? await listClients() : [];

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
            <p className="text-sm text-slate-500">Dashboard laporan performa per klien · {admin.email}</p>
          </div>
        </div>
        <a
          href="#add-client"
          className="inline-flex items-center gap-2 rounded-xl bg-[#2A2870] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#211f5c]"
        >
          <Plus className="h-4 w-4" /> Tambah Klien
        </a>
      </div>

      {/* stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Klien", value: clients.length },
          { label: "Aktif", value: clients.filter((c) => c.status === "active").length },
          { label: "Terkoneksi", value: clients.filter((c) => c.status === "connected").length },
          { label: "Belum konek", value: clients.filter((c) => c.status === "pending").length },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className="mt-1 text-3xl font-bold text-[#1B2A4A]">{s.value}</p>
          </div>
        ))}
      </div>

      {!isSupabaseAdminConfigured() && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Supabase belum terkonfigurasi.
        </div>
      )}

      {/* clients list */}
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-600">
        <Users className="h-4 w-4" /> Daftar Klien
      </div>
      {clients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
          <p className="font-semibold text-slate-700">Belum ada klien</p>
          <p className="mt-1 text-sm text-slate-500">Tambahkan klien pertama Anda di bawah.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => {
            const st = CLIENT_STATUSES[c.status] ?? CLIENT_STATUSES.pending;
            return (
              <div key={c.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
                      style={{ backgroundColor: c.brandColor }}
                    >
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-semibold text-[#1B2A4A]">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.igHandle ? `@${c.igHandle}` : c.slug}</p>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${st.badge}`}>
                    {st.label}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Link
                    href={`/report/admin/${c.id}`}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Kelola
                  </Link>
                  <Link
                    href={`/report/admin/${c.id}/settings`}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"
                    title="Setting API"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/report/c/${c.slug}`}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"
                    title="Buka laporan"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* add client */}
      <div id="add-client" className="mt-10 scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Plus className="h-4 w-4" /> Tambah Klien Baru
        </div>
        <form action={createClient} className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Nama Klien *</span>
            <input
              name="name"
              required
              placeholder="mis. Cap Gajah"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2A2870]"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Instagram Handle</span>
            <input
              name="ig_handle"
              placeholder="capgajahofficial"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2A2870]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Warna Brand</span>
              <input
                name="brand_color"
                type="color"
                defaultValue="#2A2870"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-1"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Warna Aksen</span>
              <input
                name="accent_color"
                type="color"
                defaultValue="#38B6F0"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-1"
              />
            </label>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[#2A2870] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#211f5c]"
            >
              <Plus className="h-4 w-4" /> Buat Klien
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
