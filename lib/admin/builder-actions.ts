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
