import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/brand/primitives";
import { KeysSection } from "@/components/hub/keys-section";
import { SettingsShell } from "@/components/hub/settings-shell";
import { TelegramPanel } from "@/components/hub/telegram/telegram-panel";
import { canManageTeam } from "@/lib/hub/rules";
import { secretStatus } from "@/lib/hub/secrets";
import { requireBrand } from "@/lib/hub/session";

export const metadata: Metadata = { title: "Telegram" };
export const dynamic = "force-dynamic";

export default async function TelegramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor } = await requireBrand(slug);
  if (!canManageTeam(actor)) notFound();
  const keys = await secretStatus(brand.id);
  return (
    <SettingsShell
      slug={slug}
      title="Telegram"
      description="Connect a Telegram bot that belongs to this brand, then pick the chats (a person or a team group) that should get its messages. The bot token is encrypted, belongs to this brand only and never falls back to the agency's."
    >
      <Card>
        <KeysSection brandId={brand.id} only={["telegram"]} />
      </Card>
      <Card>
        <TelegramPanel brandId={brand.id} hasToken={Boolean(keys.telegram)} />
      </Card>
    </SettingsShell>
  );
}
