import { ShieldCheck, UserPlus, Trash2, Database } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { PageHeader, Card, EmptyState, Th, Td } from "@/components/admin/ui";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { addUser, deleteUser } from "@/lib/admin/actions";
import { isAdminEmail } from "@/lib/admin/config";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PERMS: [string, string][] = [
  ["can_create", "C"],
  ["can_read", "R"],
  ["can_update", "U"],
  ["can_delete", "D"],
];

export default async function UsersPage() {
  const me = await requireAdmin();

  if (!isSupabaseAdminConfigured()) {
    return (
      <>
        <PageHeader title="User" />
        <EmptyState icon={<Database className="h-5 w-5" />} title="Supabase belum terkonfigurasi" />
      </>
    );
  }

  const db = createSupabaseAdminClient();
  const { data } = await db
    .from("admin_users")
    .select("*")
    .order("created_at", { ascending: true });
  const users = data ?? [];

  return (
    <>
      <PageHeader
        title="User"
        description="Tambah user admin dan atur hak akses CRUD-nya."
      />

      {/* add user */}
      {me.perms.create && (
        <Card className="mb-5">
          <p className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-500">
            <UserPlus className="h-3.5 w-3.5" /> Tambah user
          </p>
          <form action={addUser} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <input
              name="email"
              type="email"
              required
              placeholder="email@domain.com"
              className="rounded-xl border border-white/10 bg-obsidian/50 px-3 py-2.5 text-sm text-mist placeholder:text-slate-600 focus:border-coral/50 focus:outline-none"
            />
            <input
              name="name"
              placeholder="Nama"
              className="rounded-xl border border-white/10 bg-obsidian/50 px-3 py-2.5 text-sm text-mist placeholder:text-slate-600 focus:border-coral/50 focus:outline-none"
            />
            <select
              name="role"
              defaultValue="staff"
              className="rounded-xl border border-white/10 bg-obsidian/50 px-3 py-2.5 text-sm text-slate-200 focus:border-coral/50 focus:outline-none"
            >
              <option value="admin" className="bg-obsidian">Admin</option>
              <option value="staff" className="bg-obsidian">Staff</option>
              <option value="viewer" className="bg-obsidian">Viewer</option>
            </select>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-obsidian/50 px-3 py-2.5">
              {PERMS.map(([name, label]) => (
                <label key={name} className="flex items-center gap-1.5 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    name={name}
                    defaultChecked={name === "can_read"}
                    className="h-4 w-4 accent-coral"
                  />
                  {label}
                </label>
              ))}
            </div>
            <button className="rounded-xl bg-gradient-to-br from-coral to-sunset px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 sm:col-span-2 lg:col-span-4">
              Tambah user
            </button>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        {users.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<ShieldCheck className="h-5 w-5" />} title="Belum ada user" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-white/8 bg-white/[0.02]">
                <tr>
                  <Th>Email</Th>
                  <Th>Nama</Th>
                  <Th>Role</Th>
                  <Th>Akses</Th>
                  <Th className="text-right">Aksi</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => {
                  const owner = isAdminEmail(u.email) || u.role === "owner";
                  const isSelf = u.email === me.email;
                  return (
                    <tr key={u.id} className="hover:bg-white/[0.02]">
                      <Td>
                        <span className="font-medium text-slate-100">{u.email}</span>
                        {isSelf && <span className="ml-2 text-xs text-slate-500">(Anda)</span>}
                      </Td>
                      <Td><span className="text-slate-300">{u.name || "—"}</span></Td>
                      <Td>
                        <span className="rounded-full border border-coral/25 bg-coral/10 px-2.5 py-0.5 font-mono text-[0.66rem] uppercase text-coral">
                          {u.role}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex gap-1">
                          {PERMS.map(([name, label]) => (
                            <span
                              key={name}
                              className={cn(
                                "inline-flex h-6 w-6 items-center justify-center rounded-md font-mono text-[0.66rem]",
                                (u as Record<string, unknown>)[name]
                                  ? "bg-coral/15 text-coral"
                                  : "bg-white/5 text-slate-600",
                              )}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </Td>
                      <Td>
                        <div className="flex justify-end">
                          {me.perms.delete && !owner && !isSelf ? (
                            <form action={deleteUser.bind(null, u.id)}>
                              <ConfirmSubmit
                                message={`Hapus akses ${u.email}?`}
                                className="inline-flex items-center rounded-md bg-bad/10 px-2 py-1.5 text-xs text-bad hover:bg-bad/20"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </ConfirmSubmit>
                            </form>
                          ) : (
                            <span className="text-xs text-slate-600">—</span>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
