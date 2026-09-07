import Link from "next/link";
import {
  TrendingUp,
  KanbanSquare,
  FileText,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { requireClient } from "@/lib/client/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, PageHeader, EmptyState } from "@/components/admin/ui";
import { SuccessMeter } from "@/components/report/success-meter";
import { clientRequestUpdate } from "@/lib/client/actions";

export const dynamic = "force-dynamic";

export default async function ClientHome() {
  const m = await requireClient();
  const db = createSupabaseAdminClient();
  const [reportRes, itemsRes] = await Promise.all([
    db
      .from("reports")
      .select("id, summary, content, created_at")
      .eq("member_id", m.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("plan_items").select("id, status").eq("member_id", m.id),
  ]);

  const content = (reportRes.data?.content ?? {}) as Record<string, unknown>;
  const rb = (content.revenue_booster ?? null) as {
    current_estimate?: string;
    projected?: string;
    uplift?: string;
  } | null;
  const items = itemsRes.data ?? [];
  const total = items.length;
  const done = items.filter(
    (i) => i.status === "done" || i.status === "implemented",
  ).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <>
      <PageHeader
        title={`Halo, ${m.business} 👋`}
        description="Ringkasan progres scale-up Anda."
        action={
          <form action={clientRequestUpdate}>
            <button className="inline-flex items-center gap-2 rounded-full border border-coral/25 bg-coral/10 px-4 py-2 text-sm font-medium text-coral-soft transition-colors hover:border-coral/50">
              <RefreshCw className="h-4 w-4" /> Minta update plan
            </button>
          </form>
        }
      />

      {!reportRes.data ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="Report sedang disiapkan"
          hint="Tim ScaleUp sedang menyiapkan audit & master plan Anda. Halaman ini akan terisi otomatis."
        />
      ) : (
        <>
          {/* 3 KPI meter of success */}
          <SuccessMeter content={content} compact />
          <div className="mt-2 text-right">
            <Link href="/dashboard/score" className="text-sm text-coral hover:text-coral-soft">
              Detail score →
            </Link>
          </div>

          {/* revenue + progress */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {rb && (
              <Card className="border-coral/20 bg-gradient-to-br from-coral/10 via-card/40 to-card/40">
                <p className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-500">
                  <TrendingUp className="h-3.5 w-3.5 text-coral" /> Revenue Booster
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Sekarang</p>
                    <p className="font-mono text-slate-400">
                      {rb.current_estimate ?? "-"}
                    </p>
                  </div>
                  <span className="pb-1 text-coral">→</span>
                  <div>
                    <p className="text-xs text-slate-500">Proyeksi</p>
                    <p className="font-display text-2xl font-extrabold text-gradient-coral">
                      {rb.projected ?? "-"}
                    </p>
                  </div>
                  {rb.uplift && (
                    <span className="mb-1 rounded-full border border-good/30 bg-good/10 px-2.5 py-1 font-mono text-xs text-good">
                      {rb.uplift}
                    </span>
                  )}
                </div>
              </Card>
            )}
            <Card>
              <p className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-500">
                <KanbanSquare className="h-3.5 w-3.5 text-coral" /> Progres Plan
              </p>
              <div className="flex items-end justify-between">
                <span className="font-display text-3xl font-extrabold text-mist">
                  {pct}%
                </span>
                <span className="text-sm text-slate-500">
                  {done}/{total} selesai
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full bg-gradient-to-r from-coral to-ember"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <Link
                href="/dashboard/plan"
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-coral hover:text-coral-soft"
              >
                Buka master plan <ArrowRight className="h-4 w-4" />
              </Link>
            </Card>
          </div>

          {reportRes.data.summary && (
            <Card className="mt-4">
              <p className="mb-2 font-mono text-xs uppercase tracking-wider text-slate-500">
                Ringkasan
              </p>
              <p className="text-sm leading-relaxed text-slate-300">
                {reportRes.data.summary}
              </p>
              <Link
                href="/dashboard/report"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-coral hover:text-coral-soft"
              >
                Baca report lengkap <ArrowRight className="h-4 w-4" />
              </Link>
            </Card>
          )}
        </>
      )}
    </>
  );
}
