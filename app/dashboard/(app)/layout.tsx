import { requireClient } from "@/lib/client/auth";
import { ClientShell } from "@/components/client/client-shell";

export const dynamic = "force-dynamic";

export default async function ClientDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const m = await requireClient();
  return <ClientShell business={m.business}>{children}</ClientShell>;
}
