import type { Metadata } from "next";
import { CrmList } from "@/components/hub/crm/list";
import { requireFunction } from "@/lib/hub/access";
import { atLeast } from "@/lib/hub/permissions";
import { canManageTeam } from "@/lib/hub/rules";

export const metadata: Metadata = { title: "CRM · Clients" };
export const dynamic = "force-dynamic";

export default async function CrmClientsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand, actor, access } = await requireFunction(slug, "crm");
  return <CrmList slug={slug} brandId={brand.id} kind="client" canEdit={atLeast(access.crm, "edit")} manager={canManageTeam(actor)} sp={sp} />;
}
