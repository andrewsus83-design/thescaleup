import { notFound, redirect } from "next/navigation";
import {
  ExternalLink,
  Check,
  RefreshCw,
  CircleCheck,
  Clock,
} from "lucide-react";
import { requireClient } from "@/lib/client/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card } from "@/components/admin/ui";
import { getBuilder } from "@/lib/client/builders";
import { builderTasks, BUILDER_SLUGS } from "@/lib/builders";
import { clientRequestUpdate } from "@/lib/client/actions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function normalizeUrl(u?: string | null): string | null {
  const s = String(u ?? "").trim();
  if (!s) return null;
  return s.startsWith("http") ? s : `https://${s}`;
}

/** The client sees each builder as a finished PRODUCT (ready to use) — never
 *  the builder wizard. The wizard lives only in the admin backend. */
export default async function ClientAppPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const m = await requireClient();
  const { slug } = await params;
  const b = getBuilder(slug);
  if (!b || !BUILDER_SLUGS.includes(slug)) notFound();

  const db = createSupabaseAdminClient();
  const [{ data: project }, { data: lead }] = await Promise.all([
    db
      .from("builder_projects")
      .select("data, status, updated_at")
      .eq("member_id", m.id)
      .eq("builder", slug)
      .maybeSingle(),
    db.from("leads").select("website").eq("id", m.id).maybeSingle(),
  ]);

  // Non-internal clients can only open a product that was actually built.
  if (!m.isInternal && !project) redirect("/dashboard");

  const data = (project?.data ?? {}) as Record<string, unknown>;
  const ready = project?.status === "submitted";
  const Icon = b.icon;
  const tasks = builderTasks(slug);

  const websiteUrl =
    slug === "website"
      ? normalizeUrl(
          (data.website_url as string) ||
            (data.url as string) ||
            (lead?.website as string),
        )
      : null;

  // Primary "use it" action per product (only where a real destination exists).
  const primary: { label: string; href: string } | null = websiteUrl
    ? { label: "Kunjungi Website", href: websiteUrl }
    : slug === "content"
      ? { label: "Lihat Konten di Hub", href: "/scalehub" }
      : null;

  async function requestUpdate() {
    "use server";
    await clientRequestUpdate();
  }

  return (
    <>
      <PageHeader
        title={b.title}
        description={b.tagline}
        action={
          <form action={requestUpdate}>
            <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10">
              <RefreshCw className="h-4 w-4" /> Minta perubahan
            </button>
          </form>
        }
      />

      {/* Product hero */}
      <Card className="mb-4 border-coral/15 bg-gradient-to-br from-coral/10 via-card/40 to-card/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-coral/25 bg-coral/10 text-coral">
              <Icon className="h-6 w-6" />
            </span>
            <div>
              <p className="font-display text-lg font-bold text-mist">{b.title}</p>
              <span
                className={cn(
                  "mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  ready
                    ? "border-good/30 bg-good/10 text-good"
                    : "border-sky-500/30 bg-sky-500/10 text-sky-400",
                )}
              >
                {ready ? (
                  <>
                    <CircleCheck className="h-3.5 w-3.5" /> Aktif &amp; siap dipakai
                  </>
                ) : (
                  <>
                    <Clock className="h-3.5 w-3.5" /> Sedang disiapkan tim ScaleUp
                  </>
                )}
              </span>
            </div>
          </div>
          {primary && (
            <a
              href={primary.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-coral to-sunset px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              <ExternalLink className="h-4 w-4" /> {primary.label}
            </a>
          )}
        </div>
      </Card>

      {/* What the product includes (delivered capabilities) */}
      <Card>
        <p className="mb-3 font-mono text-xs uppercase tracking-wider text-slate-500">
          Yang termasuk di produk ini
        </p>
        <ul className="space-y-2.5">
          {tasks.map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-sm text-slate-300">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-white/5 pt-3 text-xs text-slate-500">
          Produk ini dibangun & dikelola tim ScaleUp. Butuh perubahan? Klik{" "}
          <span className="text-slate-300">Minta perubahan</span> di atas.
        </p>
      </Card>
    </>
  );
}
