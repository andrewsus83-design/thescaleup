import { BarChart3 } from "lucide-react";
import { requireClient } from "@/lib/client/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, EmptyState } from "@/components/admin/ui";
import { SuccessMeter } from "@/components/report/success-meter";
import { ScoreRing } from "@/components/ui/score-ring";

export const dynamic = "force-dynamic";

export default async function ClientScorePage() {
  const m = await requireClient();
  const db = createSupabaseAdminClient();
  const { data: report } = await db
    .from("reports")
    .select("content")
    .eq("member_id", m.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const content = (report?.content ?? {}) as Record<string, unknown>;
  const scores = (content.scores ?? {}) as Record<string, number | null>;
  const pillars = [
    { label: "CRO", v: scores.cro },
    { label: "GEO / AI Search", v: scores.geo },
    { label: "Social", v: scores.social },
    { label: "Tech", v: scores.tech },
  ];
  const hasPillars = Object.values(scores).some((v) => v != null);

  return (
    <>
      <PageHeader
        title="Score"
        description="Meter of success Anda — dipantau seiring eksekusi plan (Score Pribadi · Social · vs Kompetitor)."
      />
      {!report ? (
        <EmptyState
          icon={<BarChart3 className="h-5 w-5" />}
          title="Score belum tersedia"
          hint="Report & score Anda sedang disiapkan tim ScaleUp."
        />
      ) : (
        <div className="space-y-4">
          <SuccessMeter content={content} />
          {hasPillars && (
            <Card>
              <p className="mb-4 font-mono text-xs uppercase tracking-wider text-slate-500">
                Detail 4 Pilar
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {pillars.map((p) => (
                  <div
                    key={p.label}
                    className="flex flex-col items-center gap-2"
                  >
                    <ScoreRing value={Number(p.v ?? 0)} size={92} stroke={8} />
                    <span className="text-center text-xs text-slate-400">
                      {p.label}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
