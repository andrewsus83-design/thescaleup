"use server";

import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin/config";
import { requireAdmin } from "@/lib/admin/auth";

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  created_at: string;
};

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  await requireAdmin();
  if (!isSupabaseAdminConfigured()) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("admin_users")
    .select("id, email, name, role, can_create, can_read, can_update, can_delete, created_at")
    .order("created_at", { ascending: true });
  return (data as AdminUserRow[]) ?? [];
}

export async function addAdminUser(
  email: string,
  name: string,
  role: string,
  perms: { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean },
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (!isSupabaseAdminConfigured()) return { ok: false, error: "Admin client not configured." };
  const addr = email.trim().toLowerCase();
  if (!addr) return { ok: false, error: "Email tidak valid." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("admin_users").insert({
    email: addr,
    name: name.trim() || null,
    role,
    ...perms,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateAdminUser(
  id: string,
  role: string,
  perms: { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const caller = await requireAdmin();
  if (!isSupabaseAdminConfigured()) return { ok: false, error: "Admin client not configured." };
  const admin = createSupabaseAdminClient();

  // Prevent stripping owner's own perms
  const { data: row } = await admin
    .from("admin_users")
    .select("email")
    .eq("id", id)
    .maybeSingle();
  if (row && isAdminEmail(row.email) && caller.email === row.email && role !== "owner") {
    return { ok: false, error: "Tidak bisa mengubah role akun owner sendiri." };
  }

  const { error } = await admin.from("admin_users").update({ role, ...perms }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeAdminUser(id: string): Promise<{ ok: boolean; error?: string }> {
  const caller = await requireAdmin();
  if (!isSupabaseAdminConfigured()) return { ok: false, error: "Admin client not configured." };
  const admin = createSupabaseAdminClient();

  const { data: row } = await admin
    .from("admin_users")
    .select("email")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "User tidak ditemukan." };
  if (row.email === caller.email) return { ok: false, error: "Tidak bisa menghapus akun sendiri." };

  const { error } = await admin.from("admin_users").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
