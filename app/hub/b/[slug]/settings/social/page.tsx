import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/brand/primitives";
import { KeysSection } from "@/components/hub/keys-section";
import { SettingsShell } from "@/components/hub/settings-shell";
import { ConnectPanel } from "@/components/hub/social/connect-panel";
import { canManageTeam } from "@/lib/hub/rules";
import { requireBrand } from "@/lib/hub/session";
import { accountsForBrand } from "@/lib/hub/zernio/api";

export const metadata: Metadata = { title: "Social media connections" };
export const dynamic = "force-dynamic";

export default async function SocialConnectionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor } = await requireBrand(slug);
  if (!canManageTeam(actor)) notFound();
  const { ready, accounts, problem } = await accountsForBrand(brand.id);
  return (
    <SettingsShell
      slug={slug}
      title="Social media connections"
      description="Turn a platform on and sign in to its own approval screen in the pop-up. The accounts belong to this brand only and feed Social Media, the Inbox and Ads. The agency's Zernio key stays on the server."
    >
      <Card>
        <ConnectPanel brandId={brand.id} accounts={accounts} ready={ready} problem={problem?.message ?? null} />
      </Card>
      <Card>
        <KeysSection brandId={brand.id} only={["social"]} />
      </Card>
    </SettingsShell>
  );
}
