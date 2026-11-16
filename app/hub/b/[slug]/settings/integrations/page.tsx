import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/brand/primitives";
import { KeysSection } from "@/components/hub/keys-section";
import { SettingsShell } from "@/components/hub/settings-shell";
import { canManageTeam } from "@/lib/hub/rules";
import { requireBrand } from "@/lib/hub/session";

export const metadata: Metadata = { title: "Integrations and API keys" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor } = await requireBrand(slug);
  if (!canManageTeam(actor)) notFound();
  return (
    <SettingsShell
      slug={slug}
      title="Integrations and API keys"
      description="This brand's own keys. Leave one empty and the agency's default is used. Keys are encrypted and cannot be read back. Social accounts and WhatsApp are under Social media connections."
    >
      <Card>
        <KeysSection brandId={brand.id} only={["ai", "research", "media", "pages", "ads", "cost", "google"]} />
      </Card>
    </SettingsShell>
  );
}
