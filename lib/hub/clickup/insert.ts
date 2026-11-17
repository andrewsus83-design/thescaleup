import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PageInput } from "../wiki/model";
import { pageSlug, uniqueSlug } from "../wiki/model";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type NewPage = { id: string; input: PageInput };

/**
 * Inserts several Wiki pages in one statement (parents may be in the same batch: the foreign key is checked at the end of the
 * statement). Slugs are made unique against the brand's existing ones and each other. If two people pick the same slug at the
 * same moment, one retry with random endings.
 */
export async function insertPages(admin: Admin, brandId: string, userId: string, pages: NewPage[]): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!pages.length) return { ok: true };
  const { data } = await admin.from("wiki_pages").select("slug").eq("brand_id", brandId).limit(5000);
  const taken = new Set((data ?? []).map((r) => r.slug as string));
  const rows = (retry: boolean) =>
    pages.map((p) => {
      const base = pageSlug(p.input.title);
      const slug = retry ? `${base.slice(0, 70)}-${Math.random().toString(36).slice(2, 6)}` : uniqueSlug(base, taken);
      taken.add(slug);
      return { ...p.input, id: p.id, slug, brand_id: brandId, created_by: userId, updated_by: userId };
    });
  for (const retry of [false, true]) {
    const { error } = await admin.from("wiki_pages").insert(rows(retry));
    if (!error) return { ok: true };
    if (error.code !== "23505" || retry) {
      console.error("[clickup] wiki insert failed:", error.message);
      return { ok: false, error: "Could not save the pages. Try again." };
    }
  }
  return { ok: false, error: "Could not save the pages. Try again." };
}
