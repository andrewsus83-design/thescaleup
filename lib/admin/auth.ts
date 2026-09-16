import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isAdminEmail, ADMIN_EMAILS } from "@/lib/admin/config";
import { adminAccess, isOpenMode } from "@/lib/admin/access";

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
  // OPEN MODE — backend unprotected (temporary; toggle ADMIN_OPEN).
  if (isOpenMode()) {
    return {
      id: "open",
      email: ADMIN_EMAILS[0] ?? "admin@thescaleup.xyz",
      role: "owner",
      perms: OWNER_PERMS,
    };
  }

  // Shared access-code session (email + code; fallback while OTP email is broken).
  const access = await adminAccess();
  if (access?.role === "owner") {
    const email = access.email && isAdminEmail(access.email) ? access.email : ADMIN_EMAILS[0] ?? "admin@thescaleup.xyz";
    return { id: `owner:${email}`, email, role: "owner", perms: OWNER_PERMS };
  }
  if (access?.role === "member" && access.email) {
    const e = access.email;
    // an env owner using the member code still gets owner
    if (isAdminEmail(e)) return { id: `m:${e}`, email: e, role: "owner", perms: OWNER_PERMS };
    // otherwise resolve this user's role/perms from admin_users
    if (isSupabaseAdminConfigured()) {
      try {
        const admin = createSupabaseAdminClient();
        const { data: row } = await admin
          .from("admin_users")
          .select("role, can_create, can_read, can_update, can_delete")
          .eq("email", e)
          .maybeSingle();
        if (row) {
          return {
            id: `m:${e}`,
            email: e,
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
        /* fall through */
      }
    }
    // registered but not resolvable → sensible member perms (no delete)
    return { id: `m:${e}`, email: e, role: "admin", perms: { create: true, read: true, update: true, delete: false } };
  }

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

/** Whether an email is an allowed admin — env owner OR a row in admin_users. */
export async function isRegisteredAdmin(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  if (!e) return false;
  if (isAdminEmail(e)) return true;
  if (!isSupabaseAdminConfigured()) return false;
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.from("admin_users").select("email").eq("email", e).maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

/** Guard for admin pages/actions. Redirects to login when unauthorized. */
export async function requireAdmin(): Promise<AdminUser> {
  const u = await getAdminUser();
  if (!u) redirect("/admin/login");
  return u;
}
