import { notFound, redirect } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { requireClient } from "@/lib/client/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card } from "@/components/admin/ui";
import { getBuilderConfig } from "@/lib/builders/configs";
import { BuilderWizard } from "@/components/builders/builder-wizard";
import { clientSaveBuilderProject } from "@/lib/client/actions";
import { builderTasks } from "@/lib/builders";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function ClientBuilderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const m = await requireClient();
  const { slug } = await params;
  const config = getBuilderConfig(slug);
  if (!config) notFound();

  const db = createSupabaseAdminClient();
  const { data: project } = await db
    .from("builder_projects")
    .select("data, status")
    .eq("member_id", m.id)
    .eq("builder", slug)
    .maybeSingle();

  // Normal clients see RESULTS only (execution stays admin-only).
  if (!m.isInternal) {
    if (!project) redirect("/dashboard");
    const tasks = builderTasks(slug);
    const active = project.status === "submitted";
    return (
      <>
        <PageHeader
          title={config.title}
          description="Progres & hasil yang dikerjakan tim ScaleUp untuk brand Anda."
        />
        <Card className="mb-4 flex items-center justify-between">
          <span className="text-sm text-slate-300">Status</span>
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              active
                ? "border-good/30 bg-good/10 text-good"
                : "border-sky-500/30 bg-sky-500/10 text-sky-400",
            )}
          >
            {active ? "Aktif / Selesai" : "Sedang dikerjakan"}
          </span>
        </Card>
        <Card>
          <p className="mb-3 font-mono text-xs uppercase tracking-wider text-slate-500">
            Yang ScaleUp kerjakan
          </p>
          <ul className="space-y-2.5">
            {tasks.map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm text-slate-300">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
                {t}
              </li>
            ))}
          </ul>
        </Card>
      </>
    );
  }

  // Internal (ScaleUp) client: full builder wizard.
  return (
    <>
      <PageHeader title={config.title} description={`Untuk ${m.business}`} />
      <BuilderWizard
        memberId={m.id}
        config={config}
        initialData={(project?.data ?? {}) as Record<string, unknown>}
        onSave={clientSaveBuilderProject}
      />
      {config.suggestions && config.suggestions.length > 0 && (
        <Card className="mt-6 border-coral/15">
          <p className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-coral" /> Saran Spesialis
          </p>
          <ul className="space-y-2.5">
            {config.suggestions.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
                {s}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
