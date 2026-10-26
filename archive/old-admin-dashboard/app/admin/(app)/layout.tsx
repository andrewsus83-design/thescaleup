import { requireAdmin } from "@/lib/admin/auth";
import { isOpenMode } from "@/lib/admin/access";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  return (
    <AdminShell email={user.email} role={user.role} openMode={isOpenMode()}>
      {children}
    </AdminShell>
  );
}
