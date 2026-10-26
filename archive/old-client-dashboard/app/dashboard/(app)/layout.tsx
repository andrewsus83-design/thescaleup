import { requireClient } from "@/lib/client/auth";
import { ClientShell } from "@/components/client/client-shell";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { BUILDER_SLUGS } from "@/lib/builders";

export const dynamic = "force-dynamic";

export default async function ClientDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const m = await requireClient();

  // Builder apps in the client menu: everything for ScaleUp's internal client,
  // otherwise only the builders admin has actually built for this member.
  let builderSlugs: string[] = [];
  if (m.isInternal) {
    builderSlugs = BUILDER_SLUGS;
  } else if (isSupabaseAdminConfigured()) {
    try {
      const db = createSupabaseAdminClient();
      const { data } = await db
        .from("builder_projects")
        .select("builder")
        .eq("member_id", m.id);
      const built = new Set((data ?? []).map((r) => r.builder as string));
      builderSlugs = BUILDER_SLUGS.filter((s) => built.has(s));
    } catch {
      builderSlugs = [];
    }
  }

  return (
    <ClientShell business={m.business} builderSlugs={builderSlugs}>
      {children}
    </ClientShell>
  );
}
