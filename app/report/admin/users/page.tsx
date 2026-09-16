import Link from "next/link";
import { ArrowLeft, Users, UserPlus, Trash2, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { ADMIN_EMAILS, isAdminEmail } from "@/lib/admin/config";
import { reportAddUser, reportDeleteUser } from "@/lib/report/actions";
import { SettingsTabs } from "@/components/report/settings-tabs";

export const dynamic = "force-dynamic";

type AdminUser = { id: string; email: string; name: string | null; role: string };

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
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <Link href="/report/admin" className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>
      <div className="mb-6 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#2A2870] text-white">
          <Users className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-[#1B2A4A]">Setting</h1>
          <p className="text-sm text-slate-500">Kelola admin user &amp; role akses report.thescaleup.xyz</p>
        </div>
      </div>

      <SettingsTabs active="user" />

      {/* add user */}
      {me.perms.create && (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <UserPlus className="h-4 w-4" /> Tambah admin
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Admin bisa login via OTP email. Owner = akses penuh; Admin = kelola; Staff = tambah/lihat; Viewer = lihat.
          </p>
          <form action={reportAddUser} className="grid gap-3 sm:grid-cols-4">
            <input name="email" type="email" required placeholder="email@domain.com"
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#2A2870] sm:col-span-2" />
            <input name="name" placeholder="Nama"
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#2A2870]" />
            <select name="role" defaultValue="admin"
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#2A2870]">
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="viewer">Viewer</option>
            </select>
            <button type="submit" className="rounded-lg bg-[#2A2870] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#211f5c] sm:col-span-4">
              Tambah admin
            </button>
          </form>
        </div>
      )}

      {/* list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="p-3">Email</th>
              <th className="p-3">Nama</th>
              <th className="p-3">Role</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {envOwners.map((email) => (
              <tr key={email} className="border-b border-slate-50">
                <td className="p-3 font-medium text-[#1B2A4A]">
                  {email}
                  {email === me.email && <span className="ml-2 text-xs text-slate-400">(Anda)</span>}
                </td>
                <td className="p-3 text-slate-500">—</td>
                <td className="p-3">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-emerald-700">owner</span>
                </td>
                <td className="p-3 text-right text-xs text-slate-400">tetap (env)</td>
              </tr>
            ))}
            {users.map((u) => {
              const owner = isAdminEmail(u.email) || u.role === "owner";
              const isSelf = u.email === me.email;
              return (
                <tr key={u.id} className="border-b border-slate-50 last:border-0">
                  <td className="p-3 font-medium text-[#1B2A4A]">
                    {u.email}
                    {isSelf && <span className="ml-2 text-xs text-slate-400">(Anda)</span>}
                  </td>
                  <td className="p-3 text-slate-500">{u.name || "—"}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-slate-600">{u.role}</span>
                  </td>
                  <td className="p-3 text-right">
                    {me.perms.delete && !owner && !isSelf ? (
                      <form action={reportDeleteUser}>
                        <input type="hidden" name="id" value={u.id} />
                        <button type="submit" title="Hapus akses" className="rounded-lg border border-red-200 px-2 py-1.5 text-red-500 hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {envOwners.length === 0 && users.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-sm text-slate-500">
                  <ShieldCheck className="mx-auto mb-2 h-5 w-5 text-slate-300" /> Belum ada admin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
