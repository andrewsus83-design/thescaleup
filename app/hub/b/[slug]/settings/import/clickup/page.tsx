import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/brand/primitives";
import { ImportPanel } from "@/components/hub/clickup/import-panel";
import { KeysSection } from "@/components/hub/keys-section";
import { SettingsShell } from "@/components/hub/settings-shell";
import { canManageTeam } from "@/lib/hub/rules";
import { secretStatus } from "@/lib/hub/secrets";
import { requireBrand } from "@/lib/hub/session";

export const metadata: Metadata = { title: "Import from ClickUp" };
export const dynamic = "force-dynamic";
// Each import step is its own short call, but the scan walks the whole workspace in one.
export const maxDuration = 60;

export default async function ClickUpImportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor } = await requireBrand(slug);
  if (!canManageTeam(actor)) notFound();
  const keys = await secretStatus(brand.id);
  return (
    <SettingsShell
      slug={slug}
      title="Import from ClickUp"
      description="Brings this brand's ClickUp Docs into the Wiki and its lists into Tasks, CRM or the Content plan. It only reads ClickUp: nothing is changed or deleted there. Run it as often as you like; what is already here is skipped."
      back={{ href: `/hub/b/${slug}/settings/import`, label: "Import" }}
    >
      <Card>
        <KeysSection brandId={brand.id} only={["import"]} />
      </Card>
      <Card>
        <ImportPanel brandId={brand.id} slug={slug} hasToken={Boolean(keys.clickup)} />
      </Card>
    </SettingsShell>
  );
}
