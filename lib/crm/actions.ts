"use server";

import { revalidatePath } from "next/cache";
import { getClientMember } from "@/lib/client/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CrmContactInput = {
  name: string;
  whatsapp?: string;
  email?: string;
  source?: string;
  stage: string;
  value?: string;
  notes?: string;
};

/** Only the owning client (session member) may manage their pipeline. */
async function owner(memberId: string) {
  const m = await getClientMember();
  return m && m.id === memberId ? m : null;
}

export async function crmAddContact(
  memberId: string,
  input: CrmContactInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await owner(memberId))) return { ok: false, error: "Tidak diizinkan." };
  const name = String(input.name ?? "").trim();
  if (!name) return { ok: false, error: "Nama wajib diisi." };
  const db = createSupabaseAdminClient();
  const value = input.value ? Number(String(input.value).replace(/[^0-9.]/g, "")) || null : null;
  const { error } = await db.from("crm_contacts").insert({
    member_id: memberId,
    name,
    whatsapp: String(input.whatsapp ?? "").trim() || null,
    email: String(input.email ?? "").trim() || null,
    source: String(input.source ?? "").trim() || null,
    stage: String(input.stage ?? "").trim(),
    value,
    notes: String(input.notes ?? "").trim() || null,
  });
  if (error) return { ok: false, error: `${error.message} — pastikan migrasi 'crm_contacts' sudah dijalankan.` };
  revalidatePath("/dashboard/app/crm");
  return { ok: true };
}

export async function crmMoveContact(
  memberId: string,
  id: string,
  stage: string,
): Promise<{ ok: boolean }> {
  if (!(await owner(memberId))) return { ok: false };
  const db = createSupabaseAdminClient();
  await db.from("crm_contacts").update({ stage: String(stage) }).eq("id", id).eq("member_id", memberId);
  revalidatePath("/dashboard/app/crm");
  return { ok: true };
}

export async function crmDeleteContact(
  memberId: string,
  id: string,
): Promise<{ ok: boolean }> {
  if (!(await owner(memberId))) return { ok: false };
  const db = createSupabaseAdminClient();
  await db.from("crm_contacts").delete().eq("id", id).eq("member_id", memberId);
  revalidatePath("/dashboard/app/crm");
  return { ok: true };
}
