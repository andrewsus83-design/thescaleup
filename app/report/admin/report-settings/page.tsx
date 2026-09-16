import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, SlidersHorizontal, Plus, Trash2, Trophy, Sparkles } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { getReportRules, getTemplateName, getCustomParams } from "@/lib/report/rules";
import { saveReportRule, deleteReportRule, saveReportTemplate, saveCustomParam, deleteCustomParam } from "@/lib/report/actions";
import { RULE_METRICS, CUSTOM_PARAM_TYPES, type ReportRule, type ReportCustomParam } from "@/lib/report/types";

export const dynamic = "force-dynamic";

function CustomParamForm({ param }: { param?: ReportCustomParam }) {
  return (
    <form action={saveCustomParam} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-12">
      {param && <input type="hidden" name="id" value={param.id} />}
      <label className="sm:col-span-4">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">Nama</span>
        <input name="label" required defaultValue={param?.label ?? ""} placeholder="mis. Rekomendasi Konten"
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-[#2A2870]" />
      </label>
      <label className="sm:col-span-3">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">Tipe</span>
        <select name="type" defaultValue={param?.type ?? "analisa"}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-[#2A2870]">
          {CUSTOM_PARAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      <label className="sm:col-span-12">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">Instruksi untuk AI</span>
        <textarea name="prompt" rows={2} defaultValue={param?.prompt ?? ""}
          placeholder="mis. Analisa apakah konten giveaway efektif dan beri rekomendasi 3 ide konten minggu depan berdasarkan data."
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-[#2A2870]" />
      </label>
      <div className="sm:col-span-3">
        <button type="submit" className="w-full rounded-lg bg-[#2A2870] px-3 py-2 text-sm font-semibold text-white hover:bg-[#211f5c]">
          {param ? "Simpan" : "Tambah parameter"}
        </button>
      </div>
    </form>
  );
}

function RuleForm({ rule }: { rule?: ReportRule }) {
  return (
    <form action={saveReportRule} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-12">
      {rule && <input type="hidden" name="id" value={rule.id} />}
      <label className="sm:col-span-3">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">Label</span>
        <input name="label" required defaultValue={rule?.label ?? ""} placeholder="Juara 1"
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-[#2A2870]" />
      </label>
      <label className="sm:col-span-3">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">Metrik</span>
        <select name="metric" defaultValue={rule?.metric ?? "reach"}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-[#2A2870]">
          {RULE_METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </label>
      <label className="sm:col-span-2">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">Arah</span>
        <select name="direction" defaultValue={rule?.direction ?? "up"}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-[#2A2870]">
          <option value="up">Naik ≥</option>
          <option value="down">Turun ≥</option>
        </select>
      </label>
      <label className="sm:col-span-2">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">Threshold %</span>
        <input name="thresholdPct" type="number" step="0.1" required defaultValue={rule?.thresholdPct ?? 25}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-[#2A2870]" />
      </label>
      <label className="sm:col-span-1">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">Warna</span>
        <input name="color" type="color" defaultValue={rule?.color ?? "#6AA84F"} className="h-9 w-full rounded-lg border border-slate-200 px-0.5" />
      </label>
      <label className="sm:col-span-9">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">Catatan (opsional)</span>
        <input name="note" defaultValue={rule?.note ?? ""} placeholder="mis. performa naik dari tanggal terpilih"
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-[#2A2870]" />
      </label>
      <div className="flex items-end gap-2 sm:col-span-3">
        <button type="submit" className="flex-1 rounded-lg bg-[#2A2870] px-3 py-2 text-sm font-semibold text-white hover:bg-[#211f5c]">
          {rule ? "Simpan" : "Tambah rumus"}
        </button>
      </div>
    </form>
  );
}

export default async function ReportSettingsPage() {
  await requireAdmin();
  const [rules, templateName, customParams] = await Promise.all([getReportRules(), getTemplateName(), getCustomParams()]);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <Link href="/report/admin" className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>
      <div className="mb-6 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#2A2870] text-white">
          <SlidersHorizontal className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-[#1B2A4A]">Setting Report</h1>
          <p className="text-sm text-slate-500">Template Excel &amp; parameter rumus (dipakai saat “Tarik Report”)</p>
        </div>
      </div>

      {/* template */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <FileSpreadsheet className="h-4 w-4" /> Template Report (Excel)
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Format “Post Master - IG” (seperti file Cap Gajah): header Engagement / Actions / Impressions / Reach /
          Total Interaction, blok TOTAL &amp; AVERAGE, dan peringkat JUARA. Export Excel memakai format ini +
          rumus di bawah.
        </p>
        <form action={saveReportTemplate} className="flex flex-wrap items-end gap-2">
          <label className="flex-1">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">Nama template</span>
            <input name="template_name" defaultValue={templateName || "Post Master - IG"}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2A2870]" />
          </label>
          <button type="submit" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Simpan
          </button>
        </form>
      </div>

      {/* rules */}
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Trophy className="h-4 w-4" /> Parameter Rumus / Peringkat
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Contoh: <em>Juara 1 = Reach naik ≥ 25%</em> dalam rentang tanggal yang dipilih saat menarik report. Bisa
        tambah, ubah, hapus.
      </p>

      {rules.length > 0 && (
        <div className="mb-4 space-y-3">
          {rules.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
                <span className="flex items-center gap-2 text-sm">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: r.color ?? "#6AA84F" }} />
                  <b>{r.label}</b>
                  <span className="text-slate-500">
                    · {RULE_METRICS.find((m) => m.value === r.metric)?.label ?? r.metric}{" "}
                    {r.direction === "up" ? "naik" : "turun"} ≥ {r.thresholdPct}%
                  </span>
                </span>
                <form action={deleteReportRule}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" title="Hapus rumus" className="rounded-lg border border-red-200 px-2 py-1.5 text-red-500 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
              <div className="p-3">
                <RuleForm rule={r} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Plus className="h-4 w-4" /> Tambah Rumus Baru
        </div>
        <RuleForm />
      </div>

      {/* custom AI parameters */}
      <div className="mb-3 mt-10 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Sparkles className="h-4 w-4 text-[#2A2870]" /> Custom Parameter (AI · Claude Opus)
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Parameter custom yang <strong>dianalisa AI (Claude Opus)</strong> memakai data laporan, lalu hasilnya
        ditambahkan ke report. Contoh: <em>“Analisa efektivitas giveaway + beri 3 ide konten minggu depan.”</em>{" "}
        Butuh API key <strong>Claude</strong> terisi di Setting API klien. AI dijalankan saat “Tarik data”.
      </p>

      {customParams.length > 0 && (
        <div className="mb-4 space-y-3">
          {customParams.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
                <span className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-3.5 w-3.5 text-[#2A2870]" />
                  <b>{p.label}</b>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] capitalize text-slate-600">{p.type}</span>
                </span>
                <form action={deleteCustomParam}>
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" title="Hapus parameter" className="rounded-lg border border-red-200 px-2 py-1.5 text-red-500 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
              <div className="p-3">
                <CustomParamForm param={p} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Plus className="h-4 w-4" /> Tambah Parameter AI Baru
        </div>
        <CustomParamForm />
      </div>
    </div>
  );
}
