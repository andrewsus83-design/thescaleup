"use client";

import { useState, useTransition } from "react";
import { UserPlus, Pencil, Trash2, ShieldCheck, Loader2 } from "lucide-react";
import { Btn, Alert, Card, Sheet, inputCls, labelCls } from "@/components/room/ui";
import {
  addAdminUser,
  updateAdminUser,
  removeAdminUser,
  type AdminUserRow,
} from "@/app/admin/users/actions";

const ROLES = ["owner", "admin", "staff", "viewer"] as const;
type Role = (typeof ROLES)[number];

const ROLE_BADGE: Record<Role, string> = {
  owner: "bg-brand-chip text-brand-chip-ink",
  admin: "bg-info-bg text-ink-800",
  staff: "bg-paper-200 text-ink-600",
  viewer: "bg-paper-100 text-ink-400",
};

const DEFAULT_PERMS: Record<Role, { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }> = {
  owner: { can_create: true, can_read: true, can_update: true, can_delete: true },
  admin: { can_create: true, can_read: true, can_update: true, can_delete: false },
  staff: { can_create: false, can_read: true, can_update: true, can_delete: false },
  viewer: { can_create: false, can_read: true, can_update: false, can_delete: false },
};

function PermCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-600 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-ink-200 accent-brand-500"
      />
      {label}
    </label>
  );
}

type Perms = { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean };

function UserForm({
  initial,
  onSave,
  onCancel,
  isAdd,
}: {
  initial: { email?: string; name?: string; role: Role; perms: Perms };
  onSave: (data: { email: string; name: string; role: Role; perms: Perms }) => Promise<void>;
  onCancel: () => void;
  isAdd: boolean;
}) {
  const [email, setEmail] = useState(initial.email ?? "");
  const [name, setName] = useState(initial.name ?? "");
  const [role, setRole] = useState<Role>(initial.role);
  const [perms, setPerms] = useState<Perms>(initial.perms);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function setRole_(r: Role) {
    setRole(r);
    setPerms(DEFAULT_PERMS[r]);
  }

  function submit() {
    setErr(null);
    start(async () => {
      await onSave({ email, name, role, perms });
    });
  }

  return (
    <div className="space-y-5">
      {err && <Alert tone="bad">{err}</Alert>}
      {isAdd && (
        <div>
          <label className={labelCls}>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="nama@email.com" />
        </div>
      )}
      <div>
        <label className={labelCls}>Nama</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Nama tampilan" />
      </div>
      <div>
        <label className={labelCls}>Role</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole_(r)}
              className={`rounded-full px-3 py-1 text-sm font-medium capitalize transition-all ${
                role === r ? ROLE_BADGE[r] + " ring-2 ring-brand-500 ring-offset-1" : "bg-paper-100 text-ink-500 hover:bg-paper-200"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className={labelCls}>Permissions</p>
        <PermCheckbox label="Create" checked={perms.can_create} onChange={(v) => setPerms((p) => ({ ...p, can_create: v }))} />
        <PermCheckbox label="Read" checked={perms.can_read} onChange={(v) => setPerms((p) => ({ ...p, can_read: v }))} />
        <PermCheckbox label="Update" checked={perms.can_update} onChange={(v) => setPerms((p) => ({ ...p, can_update: v }))} />
        <PermCheckbox label="Delete" checked={perms.can_delete} onChange={(v) => setPerms((p) => ({ ...p, can_delete: v }))} />
      </div>
      {err && <Alert tone="bad">{err}</Alert>}
      <div className="flex gap-3 pt-1">
        <Btn variant="primary" onClick={submit} disabled={pending} className="flex-1">
          {pending ? <Loader2 className="size-4 animate-spin" /> : isAdd ? "Tambah Admin" : "Simpan"}
        </Btn>
        <Btn variant="ghost" onClick={onCancel} disabled={pending}>Batal</Btn>
      </div>
    </div>
  );
}

export function UsersManager({ initial }: { initial: AdminUserRow[] }) {
  const [users, setUsers] = useState(initial);
  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<AdminUserRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleAdd(data: { email: string; name: string; role: Role; perms: Perms }) {
    const res = await addAdminUser(data.email, data.name, data.role, data.perms);
    if (!res.ok) { setErr(res.error ?? "Gagal menambah admin."); return; }
    // Append optimistically with a temp id; page will re-validate on next load
    setUsers((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        email: data.email.trim().toLowerCase(),
        name: data.name || null,
        role: data.role,
        ...data.perms,
        created_at: new Date().toISOString(),
      },
    ]);
    setAddOpen(false);
    setErr(null);
  }

  async function handleEdit(row: AdminUserRow, data: { email: string; name: string; role: Role; perms: Perms }) {
    const res = await updateAdminUser(row.id, data.role, data.perms);
    if (!res.ok) { setErr(res.error ?? "Gagal menyimpan."); return; }
    setUsers((prev) =>
      prev.map((u) => (u.id === row.id ? { ...u, role: data.role, ...data.perms, name: data.name || null } : u))
    );
    setEditRow(null);
    setErr(null);
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const res = await removeAdminUser(id);
    setDeleting(null);
    if (!res.ok) { setErr(res.error ?? "Gagal menghapus."); return; }
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setErr(null);
  }

  return (
    <div className="space-y-6">
      {err && <Alert tone="bad" role="alert">{err}</Alert>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">{users.length} admin terdaftar</p>
        <Btn variant="primary" size="sm" onClick={() => setAddOpen(true)}>
          <UserPlus className="size-4" aria-hidden />
          Tambah Admin
        </Btn>
      </div>

      <Card className="divide-y divide-paper-200 p-0 overflow-hidden">
        {users.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-ink-400">Belum ada admin.</p>
        )}
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-5 py-4">
            <div className="flex size-9 items-center justify-center rounded-full bg-paper-200 text-ink-500 shrink-0">
              <ShieldCheck className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-800">{u.name ?? u.email}</p>
              {u.name && <p className="truncate text-xs text-ink-400">{u.email}</p>}
              <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                <span className={`rounded-full px-2 py-0.5 font-medium capitalize ${ROLE_BADGE[u.role as Role] ?? "bg-paper-100 text-ink-500"}`}>
                  {u.role}
                </span>
                {u.can_create && <span className="rounded-full bg-paper-100 px-2 py-0.5 text-ink-400">C</span>}
                {u.can_read && <span className="rounded-full bg-paper-100 px-2 py-0.5 text-ink-400">R</span>}
                {u.can_update && <span className="rounded-full bg-paper-100 px-2 py-0.5 text-ink-400">U</span>}
                {u.can_delete && <span className="rounded-full bg-paper-100 px-2 py-0.5 text-ink-400">D</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                aria-label={`Edit ${u.email}`}
                onClick={() => setEditRow(u)}
                className="rounded-md p-2 text-ink-400 hover:bg-paper-200 hover:text-ink-700 transition-colors"
              >
                <Pencil className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`Hapus ${u.email}`}
                onClick={() => handleDelete(u.id)}
                disabled={deleting === u.id}
                className="rounded-md p-2 text-ink-400 hover:bg-danger-bg hover:text-danger transition-colors disabled:opacity-40"
              >
                {deleting === u.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" aria-hidden />}
              </button>
            </div>
          </div>
        ))}
      </Card>

      {/* Add sheet */}
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Tambah Admin">
        <UserForm
          isAdd
          initial={{ role: "staff", perms: DEFAULT_PERMS.staff }}
          onSave={handleAdd}
          onCancel={() => setAddOpen(false)}
        />
      </Sheet>

      {/* Edit sheet */}
      <Sheet open={!!editRow} onClose={() => setEditRow(null)} title="Edit Admin">
        {editRow && (
          <UserForm
            isAdd={false}
            initial={{
              email: editRow.email,
              name: editRow.name ?? "",
              role: editRow.role as Role,
              perms: {
                can_create: editRow.can_create,
                can_read: editRow.can_read,
                can_update: editRow.can_update,
                can_delete: editRow.can_delete,
              },
            }}
            onSave={(data) => handleEdit(editRow, data)}
            onCancel={() => setEditRow(null)}
          />
        )}
      </Sheet>
    </div>
  );
}
