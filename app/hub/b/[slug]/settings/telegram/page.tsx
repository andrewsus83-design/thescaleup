import type { Metadata } from "next";
import { Card } from "@/components/brand/primitives";
import { KeysSection } from "@/components/hub/keys-section";
import { SettingsShell } from "@/components/hub/settings-shell";
import { TelegramHowTo } from "@/components/hub/telegram/how-to";
import { TelegramPanel } from "@/components/hub/telegram/telegram-panel";
import { canManageTeam } from "@/lib/hub/rules";
import { secretStatus } from "@/lib/hub/secrets";
import { requireBrand } from "@/lib/hub/session";

export const metadata: Metadata = { title: "Telegram" };
export const dynamic = "force-dynamic";

export default async function TelegramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor } = await requireBrand(slug);
  const manage = canManageTeam(actor);
  const keys = manage ? await secretStatus(brand.id) : null;
  return (
    <SettingsShell
      slug={slug}
      title="Telegram"
      description={
        manage
          ? "Connect a Telegram bot that belongs to this brand, then pick the chats (a person or a team group) that should get its messages. The bot token is encrypted, belongs to this brand only and never falls back to the agency's."
          : "Telegram is where this brand's team can get updates from the hub."
      }
    >
      {/* Until a token is saved the guide comes first: that is when someone new needs it most. */}
      {!keys?.telegram && <TelegramHowTo canConnect={manage} />}
      {manage && keys ? (
        <>
          <Card>
            <KeysSection brandId={brand.id} only={["telegram"]} />
          </Card>
          <Card>
            <TelegramPanel brandId={brand.id} hasToken={Boolean(keys.telegram)} />
          </Card>
        </>
      ) : null}
      {Boolean(keys?.telegram) && <TelegramHowTo canConnect={manage} />}
    </SettingsShell>
  );
}
