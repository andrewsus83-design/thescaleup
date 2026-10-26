import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Database } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { PageHeader, Card, EmptyState } from "@/components/admin/ui";
import { ArticleForm } from "@/components/admin/article-form";
import { blocksToRaw, type Block, type ArticleInput } from "@/lib/scalehub/content";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  if (!isSupabaseAdminConfigured()) {
    return (
      <>
        <PageHeader title="Edit Artikel" />
        <EmptyState
          icon={<Database className="h-5 w-5" />}
          title="Supabase belum terkonfigurasi"
        />
      </>
    );
  }

  const db = createSupabaseAdminClient();
  const [{ data: row }, { data: members }] = await Promise.all([
    db.from("articles").select("*").eq("id", id).maybeSingle(),
    db
      .from("leads")
      .select("id, business, name")
      .order("created_at", { ascending: false }),
  ]);
  if (!row) notFound();

  const memberOpts = (members ?? []).map((m) => ({
    id: m.id as string,
    label: (m.business as string) || (m.name as string) || "—",
  }));

  const initial: Partial<ArticleInput> = {
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt ?? "",
    category: row.category ?? "Insight",
    authorType: row.author_type === "scaleup" ? "scaleup" : "client",
    memberId: row.member_id ?? "",
    authorName: row.author_name ?? "",
    coverUrl: row.cover_url ?? "",
    contentRaw: blocksToRaw((Array.isArray(row.content) ? row.content : []) as Block[]),
    status: row.status === "published" ? "published" : "draft",
    featured: !!row.featured,
  };

  return (
    <>
      <Link
        href="/admin/scalehub"
        className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-coral"
      >
        <ArrowLeft className="h-4 w-4" /> Semua artikel
      </Link>
      <PageHeader title="Edit Artikel" description={row.title} />
      <Card>
        <ArticleForm mode="edit" id={id} members={memberOpts} initial={initial} />
      </Card>
    </>
  );
}
