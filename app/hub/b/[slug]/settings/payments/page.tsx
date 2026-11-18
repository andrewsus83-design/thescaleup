import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { KeysSection } from "@/components/hub/keys-section";
import { XenditHowTo } from "@/components/hub/payments/xendit-how-to";
import { SettingsShell } from "@/components/hub/settings-shell";
import { canManageTeam } from "@/lib/hub/rules";
import { secretStatus } from "@/lib/hub/secrets";
import { requireBrand } from "@/lib/hub/session";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

export default async function PaymentsSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor } = await requireBrand(slug);
  if (!canManageTeam(actor)) notFound();
  const connected = Boolean((await secretStatus(brand.id)).xendit);
  return (
    <SettingsShell slug={slug} title="Payments" description="Connect this brand's own Xendit account so Finance can read the payments it received and match them to invoices. The key is encrypted, belongs to this brand only and never falls back to the agency's.">
      {connected && (
        <Alert tone="ok" title="Xendit is connected.">
          Read the payments in Finance.
          <span className="mt-3 block">
            <Link href={`/hub/b/${slug}/finance/incoming`} className={btnCls("secondary", "sm", "bg-paper-0")}>
              Open Payments to review
            </Link>
          </span>
        </Alert>
      )}
      {/* Until a key is saved the guide comes first: that is when someone new needs it most. */}
      {!connected && <XenditHowTo />}
      <Card>
        <KeysSection brandId={brand.id} only={["payments"]} />
      </Card>
      {connected && <XenditHowTo />}
    </SettingsShell>
  );
}
