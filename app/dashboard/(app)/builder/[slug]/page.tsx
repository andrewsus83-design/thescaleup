import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ArrowLeft, KanbanSquare, RefreshCw } from "lucide-react";
import { requireClient } from "@/lib/client/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card } from "@/components/admin/ui";
import { getBuilder, BUILDERS } from "@/lib/client/builders";
import { planStatusMeta, PLAN_ITEM_STATUSES } from "@/lib/admin/plan-status";
import { clientRequestUpdate } from "@/lib/client/actions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return BUILDERS.map((b) => ({ slug: b.slug }));
}

export default async function BuilderDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const b = getBuilder(slug);
  if (!b) notFound();
  const m = await requireClient();

  // Progress snapshot from the member's plan items.
  const db = createSupabaseAdminClient();
  const { data: items } = await db
    .from("plan_items")
    .select("status")
    .eq("member_id", m.id)
    .eq("builder", slug);
  const counts = new Map<string, number>();
  for (const i of items ?? [])
    counts.set(i.status as string, (counts.get(i.status as string) ?? 0) + 1);

  const Icon = b.icon;

  return (
    <>
      <Link
        href="/dashboard/builder"
        className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-coral"
      >
        <ArrowLeft className="h-4 w-4" /> Semua builder
      </Link>

      <PageHeader
        title={b.title}
        description={b.tagline}
        action={
          <form action={clientRequestUpdate}>
            <button className="inline-flex items-center gap-2 rounded-full border border-coral/25 bg-coral/10 px-4 py-2 text-sm font-medium text-coral-soft transition-colors hover:border-coral/50">
              <RefreshCw className="h-4 w-4" /> Minta aktifkan / update
            </button>
          </form>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-coral/20 bg-coral/10 text-coral">
              <Icon className="h-5 w-5" />
            </span>
            <p className="font-mono text-xs uppercase tracking-wider text-slate-500">
              Yang termasuk
            </p>
          </div>
          <ul className="space-y-3">
            {b.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
                {f}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <p className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-500">
            <KanbanSquare className="h-3.5 w-3.5 text-coral" /> Status Pengerjaan
          </p>
          <div className="space-y-2">
            {PLAN_ITEM_STATUSES.map((s) => {
              const n = counts.get(s.value) ?? 0;
              return (
                <div
                  key={s.value}
                  className="flex items-center justify-between rounded-xl border border-white/8 bg-obsidian/40 px-4 py-2"
                >
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs",
                      s.badge,
                    )}
                  >
                    {s.label}
                  </span>
                  <span className="font-mono text-sm text-slate-400">{n}</span>
                </div>
              );
            })}
          </div>
          <Link
            href="/dashboard/plan"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-coral hover:text-coral-soft"
          >
            Lihat detail di Master Plan →
          </Link>
        </Card>
      </div>
    </>
  );
}
