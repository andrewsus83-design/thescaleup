import { FileSpreadsheet, SlidersHorizontal, Plus, Trash2, Trophy, Sparkles, Upload } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { getReportRules, getTemplateName, getCustomParams, getTemplateFilename } from "@/lib/report/rules";
import { saveReportRule, deleteReportRule, saveReportTemplate, saveCustomParam, deleteCustomParam, uploadReportTemplate } from "@/lib/report/actions";
import { RULE_METRICS, CUSTOM_PARAM_TYPES, REPORT_TEMPLATE_TYPES, DEFAULT_TEMPLATE_TYPE, DEFAULT_RULE_COLOR, type ReportRule, type ReportCustomParam } from "@/lib/report/types";
import { Card, Chip } from "@/components/brand/primitives";
import { btnCls, iconBtnCls, inputCls, labelCls, motion, pageX, textareaCls } from "@/components/brand/styles";
import { cn } from "@/lib/utils";
import { SettingsTabs } from "@/components/report/settings-tabs";
import { IconTile, ReportPageHead } from "@/components/report/page-head";

export const dynamic = "force-dynamic";

/** A heading above a group of forms: Title 22 with its icon. */
function GroupTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="mb-2 flex items-center gap-3 font-title text-h3 text-ink-800">
      <span className="text-ink-500">{icon}</span>
      {children}
    </h2>
  );
}

/** The dashed "add one" frame (BRAND "Card · create"). */
const addFrame = "rounded-card border-control border-dashed border-ink-200 p-6 sm:p-8";

function DeleteButton({ label }: { label: string }) {
  return (
    <button type="submit" aria-label={label} title={label} className={iconBtnCls("quiet", "border-control border-ink-200 bg-paper-0 hover:border-danger hover:text-danger")}>
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}

function CustomParamForm({ param }: { param?: ReportCustomParam }) {
  return (
    <form action={saveCustomParam} className="grid gap-4 sm:grid-cols-12">
      {param && <input type="hidden" name="id" value={param.id} />}
      <label className="sm:col-span-7">
        <span className={labelCls}>Nama</span>
        <input name="label" required defaultValue={param?.label ?? ""} placeholder="mis. Rekomendasi Konten" className={inputCls} />
      </label>
      <label className="sm:col-span-5">
        <span className={labelCls}>Tipe</span>
        <select name="type" defaultValue={param?.type ?? "analisa"} className={inputCls}>
          {CUSTOM_PARAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      <label className="sm:col-span-12">
        <span className={labelCls}>Instruksi untuk AI</span>
        <textarea
          name="prompt"
          rows={2}
          defaultValue={param?.prompt ?? ""}
          placeholder="mis. Analisa apakah konten giveaway efektif dan beri rekomendasi 3 ide konten minggu depan berdasarkan data."
          className={textareaCls}
        />
      </label>
      <div className="sm:col-span-12">
        <button type="submit" className={btnCls("dark", "lg")}>
          {param ? "Simpan" : "Tambah parameter"}
        </button>
      </div>
    </form>
  );
}

function RuleForm({ rule }: { rule?: ReportRule }) {
  return (
    <form action={saveReportRule} className="grid gap-4 sm:grid-cols-12">
      {rule && <input type="hidden" name="id" value={rule.id} />}
      <label className="sm:col-span-4">
        <span className={labelCls}>Label</span>
        <input name="label" required defaultValue={rule?.label ?? ""} placeholder="Juara 1" className={inputCls} />
      </label>
      <label className="sm:col-span-4">
        <span className={labelCls}>Metrik</span>
        <select name="metric" defaultValue={rule?.metric ?? "reach"} className={inputCls}>
          {RULE_METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </label>
      <label className="sm:col-span-4">
        <span className={labelCls}>Arah</span>
        <select name="direction" defaultValue={rule?.direction ?? "up"} className={inputCls}>
          <option value="up">Naik ≥</option>
          <option value="down">Turun ≥</option>
        </select>
      </label>
      <label className="sm:col-span-4">
        <span className={labelCls}>Threshold %</span>
        <input name="thresholdPct" type="number" step="0.1" required defaultValue={rule?.thresholdPct ?? 25} className={cn(inputCls, "font-mono")} />
      </label>
      {/* the tier colour is DATA: it paints the highlighted rows of the Excel the client receives */}
      <label className="sm:col-span-2">
        <span className={labelCls}>Warna</span>
        <input name="color" type="color" defaultValue={rule?.color ?? DEFAULT_RULE_COLOR} aria-label="Warna sorotan di Excel" className={cn(inputCls, "p-2")} />
      </label>
      <label className="sm:col-span-6">
        <span className={labelCls}>Catatan (opsional)</span>
        <input name="note" defaultValue={rule?.note ?? ""} placeholder="mis. performa naik dari tanggal terpilih" className={inputCls} />
      </label>
      <div className="sm:col-span-12">
        <button type="submit" className={btnCls("dark", "lg")}>
          {rule ? "Simpan" : "Tambah rumus"}
        </button>
      </div>
    </form>
  );
}

export default async function ReportSettingsPage() {
  await requireAdmin();
  const [rules, templateName, customParams, templateFilename] = await Promise.all([
    getReportRules(),
    getTemplateName(),
    getCustomParams(),
    getTemplateFilename(),
  ]);

  return (
    <div className={cn("mx-auto max-w-4xl py-10 sm:py-12", pageX)}>
      <ReportPageHead
        back={{ href: "/report/admin", label: "Dashboard" }}
        title="Setting"
        description="Template Excel, rumus & parameter AI (dipakai saat “Tarik Report”)"
        lead={
          <IconTile>
            <SlidersHorizontal className="size-5" aria-hidden />
          </IconTile>
        }
      />

      <SettingsTabs active="report" />

      <div className="space-y-12">
        {/* template */}
        <Card>
          <GroupTitle icon={<FileSpreadsheet className="size-5" aria-hidden />}>Template Report (Excel)</GroupTitle>
          <p className="mb-6 max-w-chat text-small text-ink-500">
            Pilih tipe report. Default = <strong className="font-semibold text-ink-800">Post Master - IG (Cap Gajah)</strong> — format file yang Anda upload. Export Excel “Tarik Report” memakai tipe ini + rumus di bawah.
          </p>
          <form action={saveReportTemplate} className="flex flex-wrap items-end gap-4">
            <label className="min-w-0 flex-1 basis-64">
              <span className={labelCls}>Tipe template</span>
              <select name="template_name" defaultValue={templateName || DEFAULT_TEMPLATE_TYPE} className={inputCls}>
                {REPORT_TEMPLATE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <button type="submit" className={btnCls("dark", "lg")}>
              Simpan
            </button>
          </form>
          <div className="mt-4 space-y-1 text-caption text-ink-500">
            {REPORT_TEMPLATE_TYPES.map((t) => (
              <p key={t.value}><b className="font-semibold text-ink-800">{t.label}:</b> {t.desc}</p>
            ))}
          </div>

          {/* upload default template */}
          <div className="mt-8 border-t border-hairline pt-6">
            <h3 className="mb-2 flex items-center gap-3 font-title text-body font-bold text-ink-800">
              <Upload className="size-4 text-ink-500" aria-hidden /> Upload Template Default (.xlsx)
            </h3>
            <p className="mb-4 max-w-chat text-small text-ink-500">
              Upload file Excel Anda (mis. Post Master Cap Gajah) sebagai template default. Saat “Tarik Report”, data ditulis ke dalam template ini. {templateFilename ? "" : "Belum ada file."}
            </p>
            {templateFilename && (
              <p className="mb-4">
                <Chip tone="ok">
                  <FileSpreadsheet className="size-4" aria-hidden /> {templateFilename}
                </Chip>
              </p>
            )}
            <form action={uploadReportTemplate} className="flex flex-wrap items-center gap-4">
              <input
                type="file"
                name="template_file"
                accept=".xlsx,.xls"
                required
                aria-label="File template Excel"
                className={cn("min-w-0 text-small text-ink-500 file:mr-4 file:h-10 file:cursor-pointer file:rounded-full file:border-0 file:bg-ink-800 file:px-5 file:text-small file:font-semibold file:text-paper-100 hover:file:bg-ink-700", motion)}
              />
              <button type="submit" className={btnCls("secondary", "lg")}>
                Upload
              </button>
            </form>
          </div>
        </Card>

        {/* rules */}
        <section aria-labelledby="rules-title">
          <GroupTitle icon={<Trophy className="size-5" aria-hidden />}>
            <span id="rules-title">Parameter Rumus / Peringkat</span>
          </GroupTitle>
          <p className="mb-6 max-w-chat text-small text-ink-500">
            Contoh: <em>Juara 1 = Reach naik ≥ 25%</em> dalam rentang tanggal yang dipilih saat menarik report. Bisa tambah, ubah, hapus.
          </p>

          {rules.length > 0 && (
            <div className="mb-6 space-y-6">
              {rules.map((r) => (
                <Card key={r.id} small className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-small">
                      {/* the swatch is the rule's own colour (data), the same one the Excel uses */}
                      <span aria-hidden className={cn("size-3 shrink-0 rounded-full", !r.color && "bg-ink-200")} style={r.color ? { backgroundColor: r.color } : undefined} />
                      <b className="font-title text-body font-bold text-ink-800">{r.label}</b>
                      <span className="text-ink-500">
                        {RULE_METRICS.find((m) => m.value === r.metric)?.label ?? r.metric} {r.direction === "up" ? "naik" : "turun"} ≥ <span className="font-mono">{r.thresholdPct}%</span>
                      </span>
                    </span>
                    <form action={deleteReportRule}>
                      <input type="hidden" name="id" value={r.id} />
                      <DeleteButton label={`Hapus rumus ${r.label}`} />
                    </form>
                  </div>
                  <RuleForm rule={r} />
                </Card>
              ))}
            </div>
          )}

          <div className={addFrame}>
            <h3 className="mb-6 flex items-center gap-3 font-title text-body font-bold text-ink-800">
              <Plus className="size-4 text-ink-500" aria-hidden /> Tambah Rumus Baru
            </h3>
            <RuleForm />
          </div>
        </section>

        {/* custom AI parameters */}
        <section aria-labelledby="ai-title">
          <GroupTitle icon={<Sparkles className="size-5" aria-hidden />}>
            <span id="ai-title">Custom Parameter (AI · Claude Opus)</span>
          </GroupTitle>
          <p className="mb-6 max-w-chat text-small text-ink-500">
            Parameter custom yang <strong className="font-semibold text-ink-800">dianalisa AI (Claude Opus)</strong> memakai data laporan, lalu hasilnya ditambahkan ke report. Contoh: <em>“Analisa efektivitas giveaway + beri 3 ide konten minggu depan.”</em> Butuh API key <strong className="font-semibold text-ink-800">Claude</strong> terisi di Setting API klien. AI dijalankan saat “Tarik data”.
          </p>

          {customParams.length > 0 && (
            <div className="mb-6 space-y-6">
              {customParams.map((p) => (
                <Card key={p.id} small className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                      <b className="font-title text-body font-bold text-ink-800">{p.label}</b>
                      <Chip tone="neutral" className="capitalize">{p.type}</Chip>
                    </span>
                    <form action={deleteCustomParam}>
                      <input type="hidden" name="id" value={p.id} />
                      <DeleteButton label={`Hapus parameter ${p.label}`} />
                    </form>
                  </div>
                  <CustomParamForm param={p} />
                </Card>
              ))}
            </div>
          )}

          <div className={addFrame}>
            <h3 className="mb-6 flex items-center gap-3 font-title text-body font-bold text-ink-800">
              <Plus className="size-4 text-ink-500" aria-hidden /> Tambah Parameter AI Baru
            </h3>
            <CustomParamForm />
          </div>
        </section>
      </div>
    </div>
  );
}
