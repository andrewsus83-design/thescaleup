import Link from "next/link";
import { KanbanSquare, ArrowRight, Database } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { PageHeader, Card, EmptyState } from "@/components/admin/ui";
import { PLAN_ITEM_STATUSES } from "@/lib/admin/plan-status";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  await requireAdmin();
  if (!isSupabaseAdminConfigured()) {
    return <EmptyState icon={<Database className="h-5 w-5" />} title="Supabase belum terkonfigurasi" />;
  }
  const db = createSupabaseAdminClient();

  const { data: plans } = await db
    .from("master_plans")
    .select("id, member_id, title, version, member:leads(business, name)")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const planIds = (plans ?? []).map((p) => p.id);
  const { data: items } = planIds.length
    ? await db
        .from("plan_items")
        .select("master_plan_id, status")
        .in("master_plan_id", planIds)
    : { data: [] as { master_plan_id: string; status: string }[] };

  const byPlan = new Map<string, Map<string, number>>();
  for (const it of items ?? []) {
    if (!byPlan.has(it.master_plan_id)) byPlan.set(it.master_plan_id, new Map());
    const m = byPlan.get(it.master_plan_id)!;
    m.set(it.status, (m.get(it.status) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="Master Plan"
        description="Semua master plan aktif klien & progres pengerjaannya."
      />

      {!plans || plans.length === 0 ? (
        <EmptyState
          icon={<KanbanSquare className="h-5 w-5" />}
          title="Belum ada master plan"
          hint="Buat master plan dari report member (buka member → Buat Master Plan)."
        />
      ) : (
        <div className="space-y-4">
          {plans.map((p) => {
            const counts = byPlan.get(p.id) ?? new Map();
            const total = [...counts.values()].reduce((a, b) => a + b, 0);
            const done = (counts.get("done") ?? 0) + (counts.get("implemented") ?? 0);
            const pct = total ? Math.round((done / total) * 100) : 0;
            const member = p.member as { business?: string; name?: string } | null;
            return (
              <Card key={p.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-mist">
                      {member?.business || member?.name || "—"}
                    </h3>
                    <p className="font-mono text-xs text-slate-500">
                      {p.title} · v{p.version} · {total} item · {pct}% selesai
                    </p>
                  </div>
                  <Link
                    href={`/admin/members/${p.member_id}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-coral/25 bg-coral/10 px-3.5 py-1.5 text-sm font-medium text-coral-soft hover:border-coral/50"
                  >
                    Kelola <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full bg-gradient-to-r from-coral to-ember" style={{ width: `${pct}%` }} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {PLAN_ITEM_STATUSES.map((s) => {
                    const n = counts.get(s.value) ?? 0;
                    if (!n) return null;
                    return (
                      <span
                        key={s.value}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                          s.badge,
                        )}
                      >
                        {s.label}
                        <span className="font-mono">{n}</span>
                      </span>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
