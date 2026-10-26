import { requireAdmin } from "@/lib/admin/auth";
import { listAdminUsers } from "./actions";
import { UsersManager } from "@/components/admin/users-manager";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin();
  const users = await listAdminUsers();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-ink-800">Admin Users</h1>
        <p className="mt-1 text-sm text-ink-500">
          Kelola akses admin — tambah, edit role &amp; permissions, atau hapus akun.
        </p>
      </div>
      <UsersManager initial={users} />
    </div>
  );
}
