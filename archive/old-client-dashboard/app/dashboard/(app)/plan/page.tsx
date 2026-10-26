import { requireClient } from "@/lib/client/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/admin/ui";
import { PlanBoard, type PlanItem } from "@/components/plan/plan-board";
import { clientUpdatePlanItem } from "@/lib/client/actions";

export const dynamic = "force-dynamic";

export default async function ClientPlanPage() {
  const m = await requireClient();
  const db = createSupabaseAdminClient();
  const [planRes, itemsRes] = await Promise.all([
    db
      .from("master_plans")
      .select("title, version")
      .eq("member_id", m.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("plan_items")
      .select("*")
      .eq("member_id", m.id)
      .order("sort", { ascending: true }),
  ]);

  return (
    <>
      <PageHeader
        title="Master Plan"
        description={
          planRes.data
            ? `${planRes.data.title} · versi ${planRes.data.version}`
            : "Belum ada plan aktif — tim ScaleUp akan menyiapkannya."
        }
      />
      <PlanBoard
        items={(itemsRes.data ?? []) as PlanItem[]}
        onUpdate={clientUpdatePlanItem}
      />
    </>
  );
}
