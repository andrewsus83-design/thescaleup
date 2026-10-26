import { Users, UserPlus, Trash2 } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { ADMIN_EMAILS, isAdminEmail } from "@/lib/admin/config";
import { reportAddUser, reportDeleteUser } from "@/lib/report/actions";
import { Card, Chip, EmptyState } from "@/components/brand/primitives";
import { btnCls, capsCls, iconBtnCls, inputCls, labelCls, motion, pageX } from "@/components/brand/styles";
import { cn } from "@/lib/utils";
import { SettingsTabs } from "@/components/report/settings-tabs";
import { IconTile, ReportPageHead } from "@/components/report/page-head";

export const dynamic = "force-dynamic";

type AdminUser = { id: string; email: string; name: string | null; role: string };

/** Table cells: 64px rows, radius 16, Paper on hover, no rules between rows (BRAND "Table / list"). */
const th = cn(capsCls, "px-4 py-3 text-left");
const td = cn("h-16 px-4 group-hover:bg-paper-100 first:rounded-l-field last:rounded-r-field", motion);

export default async function ReportUsersPage() {
  const me = await requireAdmin();
  let users: AdminUser[] = [];
  if (isSupabaseAdminConfigured()) {
    const db = createSupabaseAdminClient();
    const { data } = await db.from("admin_users").select("id, email, name, role").order("created_at", { ascending: true });
    users = (data ?? []) as AdminUser[];
  }
  // env owners that may not be in the table
  const tableEmails = new Set(users.map((u) => u.email.toLowerCase()));
  const envOwners = ADMIN_EMAILS.filter((e) => !tableEmails.has(e.toLowerCase()));

  return (
    <div className={cn("mx-auto max-w-4xl py-10 sm:py-12", pageX)}>
      <ReportPageHead
        back={{ href: "/report/admin", label: "Dashboard" }}
        title="Setting"
        description="Kelola admin user & role akses report.thescaleup.xyz"
        lead={
          <IconTile>
            <Users className="size-5" aria-hidden />
          </IconTile>
        }
      />

      <SettingsTabs active="user" />

      <div className="space-y-6">
        {/* add user */}
        {me.perms.create && (
          <Card>
            <h2 className="mb-2 flex items-center gap-3 font-title text-h3 text-ink-800">
              <UserPlus className="size-5 text-ink-500" aria-hidden /> Tambah admin
            </h2>
            <p className="mb-6 max-w-chat text-small text-ink-500">Admin bisa login via OTP email. Owner = akses penuh; Admin = kelola; Staff = tambah/lihat; Viewer = lihat.</p>
            <form action={reportAddUser} className="grid gap-4 sm:grid-cols-4">
              <label className="sm:col-span-2">
                <span className={labelCls}>Email</span>
                <input name="email" type="email" required placeholder="email@domain.com" className={inputCls} />
              </label>
              <label>
                <span className={labelCls}>Nama</span>
                <input name="name" placeholder="Nama" className={inputCls} />
              </label>
              <label>
                <span className={labelCls}>Role</span>
                <select name="role" defaultValue="admin" className={inputCls}>
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>
              <div className="sm:col-span-4">
                <button type="submit" className={btnCls("dark", "lg")}>
                  Tambah admin
                </button>
              </div>
            </form>
          </Card>
        )}

        {/* list */}
        <Card className="px-0 py-4 sm:px-0 sm:py-6">
          <div className="overflow-x-auto px-3 sm:px-5">
            <table className="w-full min-w-table-sm border-separate border-spacing-0 text-small">
              <caption className="sr-only">Admin dan role akses</caption>
              <thead>
                <tr>
                  <th className={th}>Email</th>
                  <th className={th}>Nama</th>
                  <th className={th}>Role</th>
                  <th className={cn(th, "text-right")}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {envOwners.map((email) => (
                  <tr key={email} className="group">
                    <td className={cn(td, "font-medium text-ink-800")}>
                      {email}
                      {email === me.email && <span className="ml-2 text-caption font-normal text-ink-500">(Anda)</span>}
                    </td>
                    <td className={cn(td, "text-ink-500")}>—</td>
                    <td className={td}>
                      <Chip tone="ok">owner</Chip>
                    </td>
                    <td className={cn(td, "text-right text-caption text-ink-500")}>tetap (env)</td>
                  </tr>
                ))}
                {users.map((u) => {
                  const owner = isAdminEmail(u.email) || u.role === "owner";
                  const isSelf = u.email === me.email;
                  return (
                    <tr key={u.id} className="group">
                      <td className={cn(td, "font-medium text-ink-800")}>
                        {u.email}
                        {isSelf && <span className="ml-2 text-caption font-normal text-ink-500">(Anda)</span>}
                      </td>
                      <td className={cn(td, "text-ink-500")}>{u.name || "—"}</td>
                      <td className={td}>
                        <Chip tone="neutral">{u.role}</Chip>
                      </td>
                      <td className={cn(td, "text-right")}>
                        {me.perms.delete && !owner && !isSelf ? (
                          <form action={reportDeleteUser} className="inline-flex">
                            <input type="hidden" name="id" value={u.id} />
                            <button
                              type="submit"
                              aria-label={`Hapus akses ${u.email}`}
                              title="Hapus akses"
                              className={iconBtnCls("quiet", "border-control border-ink-200 bg-paper-0 hover:border-danger hover:text-danger")}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          </form>
                        ) : (
                          <span className="text-caption text-ink-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {envOwners.length === 0 && users.length === 0 && (
            <div className="px-6 pb-4 sm:px-8">
              <EmptyState title="Belum ada admin" />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
