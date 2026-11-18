import type { Metadata } from "next";
import { FinanceIncomingView } from "@/components/hub/finance/incoming-view";
import { requireFunction } from "@/lib/hub/access";
import { getCurrency, getSourceState, listIncoming, listInvoices } from "@/lib/hub/finance/data";
import { atLeast } from "@/lib/hub/permissions";
import { canManageTeam } from "@/lib/hub/rules";
import { getBrandKey } from "@/lib/hub/secrets";
import { fmtDay, dayIn, hubTz } from "@/lib/hub/tasks/dates";
import { isTestKey } from "@/lib/hub/xendit/model";

export const metadata: Metadata = { title: "Payments to review" };
export const dynamic = "force-dynamic";

export default async function IncomingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor, access } = await requireFunction(slug, "finance");
  const tz = hubTz();
  // The key itself stays on the server: the page only learns whether there is one, and whether it is a test-mode key.
  const [key, currency, state, list, invoices] = await Promise.all([getBrandKey(brand.id, "xendit", false), getCurrency(brand.id), getSourceState(brand.id, "xendit"), listIncoming(brand.id), listInvoices(brand.id)]);
  const last = state.lastSyncedAt ? new Date(state.lastSyncedAt) : null;
  return (
    <FinanceIncomingView
      data={{
        base: `/hub/b/${slug}/finance`,
        settingsHref: `/hub/b/${slug}/settings/payments`,
        brandId: brand.id,
        currency,
        connected: key !== null,
        testMode: key !== null && isTestKey(key),
        canEdit: atLeast(access.finance, "edit"),
        canConnect: canManageTeam(actor),
        lastRead: last ? `${fmtDay(dayIn(tz, last))} at ${new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(last)}` : null,
        more: state.pendingUntil !== null,
        list,
        invoices: invoices.open.map((i) => ({ id: i.id, number: i.number, client: i.client, amount: i.amount })),
      }}
    />
  );
}
