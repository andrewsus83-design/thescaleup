import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireClient } from "@/lib/client/auth";
import { PageHeader } from "@/components/admin/ui";
import { BUILDERS } from "@/lib/client/builders";

export const dynamic = "force-dynamic";

export default async function BuilderHub() {
  await requireClient();
  return (
    <>
      <PageHeader
        title="Builder"
        description="Produk & layanan ScaleUp untuk membangun bisnis Anda. Progres tiap builder dilacak di Master Plan."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BUILDERS.map((b) => {
          const Icon = b.icon;
          return (
            <Link
              key={b.slug}
              href={`/dashboard/builder/${b.slug}`}
              className="group flex flex-col rounded-2xl border border-white/8 bg-card/40 p-5 transition-all hover:-translate-y-1 hover:border-coral/30"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-coral/20 bg-coral/10 text-coral">
                  <Icon className="h-5 w-5" />
                </span>
                <ArrowUpRight className="h-4 w-4 text-slate-600 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-coral" />
              </div>
              <h3 className="mt-4 font-display text-base font-bold text-mist group-hover:text-coral-soft">
                {b.title}
              </h3>
              <p className="mt-1 text-sm text-slate-400">{b.tagline}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
