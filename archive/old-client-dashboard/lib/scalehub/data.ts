import "server-only";
import { posts } from "@/lib/blog";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import type { Article, Block } from "./content";

/** ScaleUp editorial (static, from lib/blog) mapped to the unified shape. */
export function editorialArticles(): Article[] {
  return posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: p.category,
    date: p.date,
    readMinutes: p.readMinutes,
    content: p.content,
    source: "scaleup" as const,
    authorName: "ScaleUp",
    coverUrl: null,
    featured: false,
  }));
}

type ArticleRow = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  content: unknown;
  cover_url: string | null;
  author_type: string;
  author_name: string;
  read_minutes: number;
  featured: boolean;
  published_at: string | null;
  created_at: string;
};

const SELECT =
  "slug, title, excerpt, category, content, cover_url, author_type, author_name, read_minutes, featured, published_at, created_at";

function rowToArticle(r: ArticleRow): Article {
  return {
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt || "",
    category: r.category || "Insight",
    date: r.published_at || r.created_at,
    readMinutes: r.read_minutes || 4,
    content: (Array.isArray(r.content) ? r.content : []) as Block[],
    source: r.author_type === "scaleup" ? "scaleup" : "client",
    authorName:
      r.author_name || (r.author_type === "scaleup" ? "ScaleUp" : "Klien ScaleUp"),
    coverUrl: r.cover_url,
    featured: r.featured,
  };
}

/** Published client-authored articles from the DB (empty if table/env absent). */
export async function clientArticles(): Promise<Article[]> {
  if (!isSupabaseAdminConfigured()) return [];
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from("articles")
      .select(SELECT)
      .eq("status", "published")
      .order("published_at", { ascending: false });
    if (error) return [];
    return (data ?? []).map((r) => rowToArticle(r as ArticleRow));
  } catch {
    return [];
  }
}

export async function getAllArticles(): Promise<Article[]> {
  const editorial = editorialArticles();
  const client = await clientArticles();
  return [...editorial, ...client].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const editorial = editorialArticles().find((a) => a.slug === slug);
  if (editorial) return editorial;
  const client = await clientArticles();
  return client.find((a) => a.slug === slug) ?? null;
}

/** A member's published articles — surfaced to the client as a "result". */
export async function memberPublishedArticles(
  memberId: string,
): Promise<Article[]> {
  if (!isSupabaseAdminConfigured() || !memberId) return [];
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from("articles")
      .select(SELECT)
      .eq("status", "published")
      .eq("member_id", memberId)
      .order("published_at", { ascending: false });
    if (error) return [];
    return (data ?? []).map((r) => rowToArticle(r as ArticleRow));
  } catch {
    return [];
  }
}
