import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card, Chip } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { KeysSection } from "@/components/hub/keys-section";
import { XenditHowTo } from "@/components/hub/payments/xendit-how-to";
import { SettingsShell } from "@/components/hub/settings-shell";
import { GATEWAYS, type GatewayId } from "@/lib/hub/payments/model";
import { canManageTeam } from "@/lib/hub/rules";
import { secretStatus } from "@/lib/hub/secrets";
import { requireBrand } from "@/lib/hub/session";

export const metadata: Metadata = { title: "Payment gateways" };
export const dynamic = "force-dynamic";

/** The step-by-step guide of each gateway. A gateway is only listed once its guide exists. */
const GUIDE: Record<GatewayId, React.ReactNode> = { xendit: <XenditHowTo /> };

export default async function PaymentsSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor } = await requireBrand(slug);
  if (!canManageTeam(actor)) notFound();
  const keys = await secretStatus(brand.id);
  const anyConnected = GATEWAYS.some((g) => Boolean(keys[g.keyProvider]));
  return (
    <SettingsShell
      slug={slug}
      title="Payment gateways"
      description="Connect the gateway this brand takes payments with, so Finance can read the payments it received and match them to invoices. Every key is encrypted, belongs to this brand only and never falls back to the agency's."
    >
      {anyConnected && (
        <Alert tone="ok" title="A payment gateway is connected.">
          Read the payments in Finance.
          <span className="mt-3 block">
            <Link href={`/hub/b/${slug}/finance/incoming`} className={btnCls("secondary", "sm", "bg-paper-0")}>
              Open Payments to review
            </Link>
          </span>
        </Alert>
      )}

      <Card>
        <h2 className="font-title text-h3 text-ink-800">Gateways you can connect</h2>
        <ul className="mt-4 divide-y divide-ink-100">
          {GATEWAYS.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <div className="min-w-0">
                <p className="text-body font-semibold text-ink-800">{g.label}</p>
                <p className="text-small text-ink-500">Reads the payments that succeeded. The hub cannot charge, refund or withdraw.</p>
              </div>
              {keys[g.keyProvider] ? <Chip tone="ok">Connected</Chip> : <Chip tone="neutral">Not connected</Chip>}
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-field bg-paper-100 px-5 py-4 text-small font-normal text-ink-600">
          Using another gateway, such as Midtrans, DOKU or Stripe? Each one shares payments in its own way, so they are added one at a time. Tell the agency which gateway this brand uses. Until it is added, enter that money in Finance by hand.
        </p>
      </Card>

      <Card>
        <KeysSection brandId={brand.id} only={["payments"]} />
      </Card>

      {/* One guide per gateway. A gateway that is not connected yet shows its guide open, because that is when it is needed. */}
      {GATEWAYS.map((g) => (
        <details key={g.id} open={!keys[g.keyProvider]} className="group">
          <summary className="hit-44 mb-3 flex cursor-pointer list-none items-center justify-between gap-4 rounded-field px-1 font-title text-h4 text-ink-800 [&::-webkit-details-marker]:hidden">
            Guide: connect {g.label}
            <span className="text-small font-semibold text-brand-700 underline underline-offset-4 group-open:hidden">Show</span>
            <span className="hidden text-small font-semibold text-brand-700 underline underline-offset-4 group-open:inline">Hide</span>
          </summary>
          {GUIDE[g.id]}
        </details>
      ))}
    </SettingsShell>
  );
}
