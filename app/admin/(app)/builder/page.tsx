import Link from "next/link";
import { Check, Database, ArrowUpRight } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { PageHeader, EmptyState } from "@/components/admin/ui";
import { BUILDERS } from "@/lib/client/builders";

export const dynamic = "force-dynamic";

export default async function AdminBuilderPage() {
  await requireAdmin();
  if (!isSupabaseAdminConfigured()) {
    return <EmptyState icon={<Database className="h-5 w-5" />} title="Supabase belum terkonfigurasi" />;
  }

  // Usage per builder (guarded — plan_items.builder column may not exist yet).
  const usage = new Map<string, { total: number; done: number }>();
  try {
    const db = createSupabaseAdminClient();
    const { data } = await db.from("plan_items").select("builder, status");
    for (const it of data ?? []) {
      const b = it.builder as string | null;
      if (!b) continue;
      const u = usage.get(b) ?? { total: 0, done: 0 };
      u.total += 1;
      if (it.status === "done") u.done += 1;
      usage.set(b, u);
    }
  } catch {
    // column not present — show catalog without stats
  }

  return (
    <>
      <PageHeader
        title="Builder"
        description="Katalog 7 produk/jasa yang ScaleUp jual & kerjakan untuk klien. Direkomendasikan otomatis oleh engine per member, lalu dieksekusi via Master Plan."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BUILDERS.map((b) => {
          const Icon = b.icon;
          const u = usage.get(b.slug);
          return (
            <Link
              key={b.slug}
              href={`/admin/builder/${b.slug}`}
              className="group flex flex-col rounded-2xl border border-white/8 bg-card/40 p-5 transition-all hover:-translate-y-1 hover:border-coral/30"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-coral/20 bg-coral/10 text-coral">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex items-center gap-2">
                  {u && (
                    <span className="font-mono text-xs text-slate-500">
                      {u.done}/{u.total} item
                    </span>
                  )}
                  <ArrowUpRight className="h-4 w-4 text-slate-600 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-coral" />
                </span>
              </div>
              <h3 className="mt-4 font-display text-base font-bold text-mist">
                {b.title}
              </h3>
              <p className="mt-1 text-sm text-slate-400">{b.tagline}</p>
              <ul className="mt-4 space-y-2 border-t border-white/5 pt-4">
                {b.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-coral" />
                    {f}
                  </li>
                ))}
              </ul>
            </Link>
          );
        })}
      </div>
    </>
  );
}
