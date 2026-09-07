"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Save (upsert) a builder project's data for a member. */
export async function saveBuilderProject(
  memberId: string,
  builder: string,
  data: Record<string, unknown>,
  status?: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (!memberId || !builder) return { ok: false, error: "member/builder kosong" };
  const db = createSupabaseAdminClient();
  const row: Record<string, unknown> = {
    member_id: memberId,
    builder,
    data,
    updated_at: new Date().toISOString(),
  };
  if (status) row.status = status;
  const { error } = await db
    .from("builder_projects")
    .upsert(row, { onConflict: "member_id,builder" });
  if (error) {
    return {
      ok: false,
      error: `${error.message} — pastikan migrasi builder_projects sudah dijalankan.`,
    };
  }
  revalidatePath(`/admin/builder/${builder}`);
  return { ok: true };
}

/**
 * Website save with a published snapshot. status "submitted" = Publish (copies
 * the working doc into data.published so the public site updates); any other
 * status (draft / preview) saves the working copy but PRESERVES the last
 * published snapshot, so unpublished edits never leak to the public site.
 */
export async function saveWebsite(
  memberId: string,
  _builder: string,
  data: Record<string, unknown>,
  status?: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (!memberId) return { ok: false, error: "member kosong" };
  const db = createSupabaseAdminClient();

  const { data: existing } = await db
    .from("builder_projects")
    .select("data, status")
    .eq("member_id", memberId)
    .eq("builder", "website")
    .maybeSingle();
  const prev = (existing?.data ?? {}) as Record<string, unknown>;

  const publish = status === "submitted";
  const snapshot = { theme: data.theme, pages: data.pages };
  // Preserve the last published snapshot on draft/preview; for legacy rows
  // (submitted, no snapshot) capture the PREVIOUS working doc as the snapshot
  // before overwriting, so the public site keeps the old version.
  const legacyPublished =
    existing?.status === "submitted" && prev.pages
      ? { theme: prev.theme, pages: prev.pages }
      : null;
  const published = publish ? snapshot : (prev.published ?? legacyPublished);

  const row = {
    member_id: memberId,
    builder: "website",
    data: { ...data, published },
    status: publish ? "submitted" : (existing?.status ?? "draft"),
    updated_at: new Date().toISOString(),
  };
  const { error } = await db
    .from("builder_projects")
    .upsert(row, { onConflict: "member_id,builder" });
  if (error) {
    return { ok: false, error: `${error.message} — pastikan migrasi builder_projects sudah dijalankan.` };
  }
  revalidatePath(`/admin/builder/website`);
  revalidatePath(`/site/${memberId}`);
  return { ok: true };
}
