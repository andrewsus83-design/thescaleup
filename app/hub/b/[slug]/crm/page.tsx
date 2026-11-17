import type { Metadata } from "next";
import { CrmList } from "@/components/hub/crm/list";
import { requireFunction } from "@/lib/hub/access";
import { atLeast } from "@/lib/hub/permissions";

export const metadata: Metadata = { title: "CRM · Leads" };
export const dynamic = "force-dynamic";

export default async function CrmLeadsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand, access } = await requireFunction(slug, "crm");
  return <CrmList slug={slug} brandId={brand.id} kind="lead" canEdit={atLeast(access.crm, "edit")} sp={sp} />;
}
