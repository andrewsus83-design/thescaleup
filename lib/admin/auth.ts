import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin/config";

export type AdminUser = {
  id: string;
  email: string;
  role: string;
  perms: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
};

const OWNER_PERMS = { create: true, read: true, update: true, delete: true };

/** Returns the current admin user, or null if not authenticated/authorized. */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const email = user?.email?.toLowerCase() ?? null;
  if (!user || !email) return null;

  // Owner allowlist (env) — always full access.
  if (isAdminEmail(email)) {
    return { id: user.id, email, role: "owner", perms: OWNER_PERMS };
  }

  // Otherwise must be in admin_users.
  if (isSupabaseAdminConfigured()) {
    try {
      const admin = createSupabaseAdminClient();
      const { data: row } = await admin
        .from("admin_users")
        .select("role, can_create, can_read, can_update, can_delete")
        .eq("email", email)
        .maybeSingle();
      if (row) {
        return {
          id: user.id,
          email,
          role: row.role ?? "staff",
          perms: {
            create: !!row.can_create,
            read: !!row.can_read,
            update: !!row.can_update,
            delete: !!row.can_delete,
          },
        };
      }
    } catch {
      // fall through to unauthorized
    }
  }
  return null;
}

/** Guard for admin pages/actions. Redirects to login when unauthorized. */
export async function requireAdmin(): Promise<AdminUser> {
  const u = await getAdminUser();
  if (!u) redirect("/admin/login");
  return u;
}
