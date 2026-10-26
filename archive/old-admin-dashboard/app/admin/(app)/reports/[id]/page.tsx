import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Database, Sparkles } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { Card, EmptyState } from "@/components/admin/ui";
import { ReportView } from "@/components/report/report-view";
import { ReportStatusSelect } from "@/components/admin/report-status-select";
import { reportStatusMeta } from "@/lib/admin/config";

export const dynamic = "force-dynamic";

export default async function AdminReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  if (!isSupabaseAdminConfigured()) {
    return <EmptyState icon={<Database className="h-5 w-5" />} title="Supabase belum terkonfigurasi" />;
  }

  const db = createSupabaseAdminClient();
  const { data: r } = await db.from("reports").select("*").eq("id", id).single();
  if (!r) notFound();

  const content = (r.content ?? {}) as Record<string, unknown>;
  const context = (content.context ?? {}) as Record<string, unknown>;
  const engineInfo = content.engine as { provider?: string; model?: string } | undefined;
  const engineError = content.engine_error as string | undefined;

  return (
    <>
      <Link
        href="/admin/reports"
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-coral"
      >
        <ArrowLeft className="h-4 w-4" />
        Semua report
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist">{r.title}</h1>
          {engineInfo?.provider && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-coral/25 bg-coral/10 px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-wider text-coral-soft">
              <Sparkles className="h-3 w-3" /> {engineInfo.provider}
              {engineInfo.model ? ` · ${engineInfo.model}` : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/admin/reports/${r.id}/download`}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5"
          >
            <Download className="h-4 w-4" /> Download
          </a>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${reportStatusMeta(r.status).badge}`}
          >
            {reportStatusMeta(r.status).label}
          </span>
          <ReportStatusSelect id={r.id} status={r.status ?? "draft"} />
        </div>
      </div>

      {Object.keys(context).length > 0 && (
        <Card className="mb-4">
          <p className="mb-4 font-mono text-xs uppercase tracking-wider text-slate-500">
            Konteks Bisnis
          </p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {Object.entries(context).map(([k, v]) => {
              if (!v || (Array.isArray(v) && v.length === 0)) return null;
              return (
                <div key={k}>
                  <dt className="text-xs capitalize text-slate-500">{k}</dt>
                  <dd className="break-words text-slate-200">
                    {Array.isArray(v) ? v.join(", ") : String(v)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Card>
      )}

      <ReportView content={content} summary={r.summary} />

      {engineError && (
        <p className="mt-4 text-xs text-warn">Catatan engine: {engineError}</p>
      )}
    </>
  );
}
