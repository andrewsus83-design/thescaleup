import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/brand/primitives";
import { SettingsShell } from "@/components/hub/settings-shell";
import { WorkflowEditor } from "@/components/hub/workflow-editor";
import { canManageTeam } from "@/lib/hub/rules";
import { requireBrand } from "@/lib/hub/session";
import { getWorkflow } from "@/lib/hub/tasks/data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Workflow" };
export const dynamic = "force-dynamic";

export default async function WorkflowPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor } = await requireBrand(slug);
  if (!canManageTeam(actor)) notFound();
  const workflow = await getWorkflow(brand.id);
  const { data } = await createSupabaseAdminClient().from("tasks").select("status").eq("brand_id", brand.id).limit(50_000);
  const used = new Map<string, number>();
  for (const t of data ?? []) used.set(String(t.status), (used.get(String(t.status)) ?? 0) + 1);
  return (
    <SettingsShell slug={slug} title="Workflow" description="The steps a task goes through, from idea to done. Rename them, reorder them, add your own. What each step means stays fixed once tasks use it.">
      <Card>
        <WorkflowEditor brandId={brand.id} approvalRequired={workflow.approvalRequired} initial={workflow.statuses.map((s) => ({ ...s, used: used.get(s.key) ?? 0 }))} />
      </Card>
    </SettingsShell>
  );
}
