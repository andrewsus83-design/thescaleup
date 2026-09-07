"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  parseContentToBlocks,
  estimateReadMinutes,
  slugify,
  type ArticleInput,
} from "@/lib/scalehub/content";

type Db = ReturnType<typeof createSupabaseAdminClient>;

function revalidateAll() {
  revalidatePath("/admin/scalehub");
  revalidatePath("/scalehub");
  revalidatePath("/sitemap.xml");
}

async function resolveAuthorName(db: Db, input: ArticleInput): Promise<string> {
  if (input.authorType === "scaleup") return "ScaleUp";
  if (input.authorName?.trim()) return input.authorName.trim();
  if (input.memberId) {
    const { data } = await db
      .from("leads")
      .select("business, name")
      .eq("id", input.memberId)
      .maybeSingle();
    return (data?.business as string) || (data?.name as string) || "Klien ScaleUp";
  }
  return "Klien ScaleUp";
}

function buildRow(
  input: ArticleInput,
  authorName: string,
  content: ReturnType<typeof parseContentToBlocks>,
) {
  const status = input.status === "published" ? "published" : "draft";
  return {
    title: input.title.trim(),
    excerpt: input.excerpt?.trim() || "",
    category: input.category?.trim() || "Insight",
    cover_url: input.coverUrl?.trim() || null,
    content,
    author_type: input.authorType === "scaleup" ? "scaleup" : "client",
    author_name: authorName,
    member_id: input.authorType === "client" ? input.memberId || null : null,
    read_minutes: estimateReadMinutes(content),
    status,
    featured: !!input.featured,
    updated_at: new Date().toISOString(),
  };
}

export async function createArticle(
  input: ArticleInput,
): Promise<{ ok: boolean; error?: string; slug?: string }> {
  await requireAdmin();
  const title = input.title?.trim();
  if (!title) return { ok: false, error: "Judul wajib diisi." };

  const db = createSupabaseAdminClient();
  const content = parseContentToBlocks(input.contentRaw || "");
  const authorName = await resolveAuthorName(db, input);

  let slug = slugify(input.slug?.trim() || title);
  if (!slug) slug = `artikel-${Date.now().toString(36)}`;
  const { data: exists } = await db
    .from("articles")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (exists) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const row = buildRow(input, authorName, content);
  const { error } = await db.from("articles").insert({
    ...row,
    slug,
    published_at: row.status === "published" ? new Date().toISOString() : null,
    created_at: new Date().toISOString(),
  });
  if (error) {
    return {
      ok: false,
      error: `${error.message} — pastikan migrasi 'articles' sudah dijalankan.`,
    };
  }
  revalidateAll();
  return { ok: true, slug };
}

export async function updateArticle(
  id: string,
  input: ArticleInput,
): Promise<{ ok: boolean; error?: string; slug?: string }> {
  await requireAdmin();
  if (!id) return { ok: false, error: "id kosong" };
  const title = input.title?.trim();
  if (!title) return { ok: false, error: "Judul wajib diisi." };

  const db = createSupabaseAdminClient();
  const content = parseContentToBlocks(input.contentRaw || "");
  const authorName = await resolveAuthorName(db, input);
  const patch: Record<string, unknown> = { ...buildRow(input, authorName, content) };

  if (input.slug?.trim()) {
    const s = slugify(input.slug.trim());
    const { data: clash } = await db
      .from("articles")
      .select("id")
      .eq("slug", s)
      .neq("id", id)
      .maybeSingle();
    patch.slug = clash ? `${s}-${Date.now().toString(36).slice(-4)}` : s;
  }

  if (patch.status === "published") {
    const { data: cur } = await db
      .from("articles")
      .select("published_at")
      .eq("id", id)
      .maybeSingle();
    if (!cur?.published_at) patch.published_at = new Date().toISOString();
  }

  const { error } = await db.from("articles").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true, slug: patch.slug as string | undefined };
}

export async function setArticleStatus(id: string, status: string) {
  await requireAdmin();
  if (status !== "draft" && status !== "published") return;
  const db = createSupabaseAdminClient();
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "published") patch.published_at = new Date().toISOString();
  await db.from("articles").update(patch).eq("id", id);
  revalidateAll();
}

export async function deleteArticle(id: string) {
  const user = await requireAdmin();
  if (!user.perms.delete) return;
  const db = createSupabaseAdminClient();
  await db.from("articles").delete().eq("id", id);
  revalidateAll();
}
