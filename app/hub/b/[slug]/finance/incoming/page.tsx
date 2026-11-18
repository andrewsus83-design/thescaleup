import type { Metadata } from "next";
import { FinanceIncomingView } from "@/components/hub/finance/incoming-view";
import { requireFunction } from "@/lib/hub/access";
import { getCurrency, getSourceState, listIncoming, listInvoices } from "@/lib/hub/finance/data";
import { atLeast } from "@/lib/hub/permissions";
import { canManageTeam } from "@/lib/hub/rules";
import { getBrandKey } from "@/lib/hub/secrets";
import { fmtDay, dayIn, hubTz } from "@/lib/hub/tasks/dates";
import { GATEWAYS, isTestKeyOf } from "@/lib/hub/payments/model";

export const metadata: Metadata = { title: "Payments to review" };
export const dynamic = "force-dynamic";

export default async function IncomingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor, access } = await requireFunction(slug, "finance");
  const tz = hubTz();
  // A key stays on the server: the page only learns whether there is one, and whether it is a test-mode key.
  const [currency, list, invoices, gateways] = await Promise.all([
    getCurrency(brand.id),
    listIncoming(brand.id),
    listInvoices(brand.id),
    Promise.all(
      GATEWAYS.map(async (g) => {
        const [key, state] = await Promise.all([getBrandKey(brand.id, g.keyProvider, false), getSourceState(brand.id, g.id)]);
        const last = state.lastSyncedAt ? new Date(state.lastSyncedAt) : null;
        return {
          id: g.id,
          label: g.label,
          connected: key !== null,
          testMode: key !== null && isTestKeyOf(g, key),
          lastRead: last ? `${fmtDay(dayIn(tz, last))} at ${new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(last)}` : null,
          more: state.pendingUntil !== null,
        };
      }),
    ),
  ]);
  return (
    <FinanceIncomingView
      data={{
        base: `/hub/b/${slug}/finance`,
        settingsHref: `/hub/b/${slug}/settings/payments`,
        brandId: brand.id,
        currency,
        gateways,
        canEdit: atLeast(access.finance, "edit"),
        canConnect: canManageTeam(actor),
        list,
        invoices: invoices.open.map((i) => ({ id: i.id, number: i.number, client: i.client, amount: i.amount })),
      }}
    />
  );
}
