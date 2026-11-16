import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, EmptyState } from "@/components/brand/primitives";
import { KeysSection } from "@/components/hub/keys-section";
import { SettingsShell } from "@/components/hub/settings-shell";
import { canManageTeam } from "@/lib/hub/rules";
import { requireBrand } from "@/lib/hub/session";
import { Share2 } from "lucide-react";

export const metadata: Metadata = { title: "Social media connections" };
export const dynamic = "force-dynamic";

export default async function SocialConnectionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor } = await requireBrand(slug);
  if (!canManageTeam(actor)) notFound();
  return (
    <SettingsShell
      slug={slug}
      title="Social media connections"
      description="One Zernio key connects this brand's social accounts and WhatsApp. It belongs to this brand only and never falls back to the agency's. The Metricool token and user ID fall back to the agency's when left empty; the Metricool brand ID is always this brand's own."
    >
      <Card>
        <KeysSection brandId={brand.id} only={["social"]} />
      </Card>
      <EmptyState icon={<Share2 className="size-6" aria-hidden />} title="Account list coming next" hint="Once the key is saved, the connected accounts and their status will show here, and feed Social Media and the Inbox." />
    </SettingsShell>
  );
}
