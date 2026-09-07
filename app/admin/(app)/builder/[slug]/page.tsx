import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, Database, Sparkles } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { PageHeader, Card, EmptyState } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/ui";
import { getBuilderConfig } from "@/lib/builders/configs";
import { BuilderWizard } from "@/components/builders/builder-wizard";
import { WebsiteBuilder } from "@/components/builders/website/website-builder";
import { coerceDoc } from "@/lib/builders/website/schema";
import { saveBuilderProject } from "@/lib/admin/builder-actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function BuilderToolPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ member?: string }>;
}) {
  await requireAdmin();
  const { slug } = await params;
  const { member: memberId } = await searchParams;
  const config = getBuilderConfig(slug);
  if (!config) notFound();

  if (!isSupabaseAdminConfigured()) {
    return <EmptyState icon={<Database className="h-5 w-5" />} title="Supabase belum terkonfigurasi" />;
  }
  const db = createSupabaseAdminClient();

  // Step 0: pick a member to run this builder for.
  if (!memberId) {
    const { data: members } = await db
      .from("leads")
      .select("id, business, name, status")
      .order("created_at", { ascending: false });
    return (
      <>
        <Link href="/admin/builder" className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-coral">
          <ArrowLeft className="h-4 w-4" /> Semua builder
        </Link>
        <PageHeader title={config.title} description={`Pilih member untuk menjalankan ${config.title}.`} />
        {!members || members.length === 0 ? (
          <EmptyState icon={<Users className="h-5 w-5" />} title="Belum ada member" />
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-white/5">
              {members.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/admin/builder/${slug}?member=${m.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-white/5"
                  >
                    <span className="truncate text-sm text-slate-200">
                      {m.business || m.name || "—"}
                    </span>
                    <StatusBadge status={m.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </>
    );
  }

  const [{ data: member }, { data: project }] = await Promise.all([
    db.from("leads").select("business, name").eq("id", memberId).single(),
    db
      .from("builder_projects")
      .select("data")
      .eq("member_id", memberId)
      .eq("builder", slug)
      .maybeSingle(),
  ]);
  const memberName = member?.business || member?.name || "Member";

  return (
    <>
      <Link href={`/admin/builder/${slug}`} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-coral">
        <ArrowLeft className="h-4 w-4" /> Ganti member
      </Link>
      <PageHeader
        title={config.title}
        description={
          slug === "website"
            ? `Bangun website ${memberName} secara visual — seret, atur, lihat langsung.`
            : `Untuk ${memberName}`
        }
      />

      {slug === "website" ? (
        <WebsiteBuilder
          memberId={memberId}
          initialDoc={coerceDoc(project?.data, memberName)}
          onSave={saveBuilderProject}
        />
      ) : (
        <BuilderWizard
          memberId={memberId}
          config={config}
          initialData={(project?.data ?? {}) as Record<string, unknown>}
        />
      )}

      {slug !== "website" && config.suggestions && config.suggestions.length > 0 && (
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
