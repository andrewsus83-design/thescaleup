import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { Chip, EmptyState, type Tone } from "@/components/brand/primitives";
import { btnCls, cardCls } from "@/components/brand/styles";
import { MailShell } from "@/components/hub/mail/shell";
import { requireFunction } from "@/lib/hub/access";
import { listCampaigns, type CampaignRow } from "@/lib/hub/email/data";
import { countUnread, listAddresses, listDomains } from "@/lib/hub/mail/data";
import { atLeast } from "@/lib/hub/permissions";
import { fmtStamp, hubTz, todayIn } from "@/lib/hub/tasks/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

const STATUS: Record<CampaignRow["status"], { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  sending: { label: "Sending", tone: "warn" },
  sent: { label: "Sent", tone: "ok" },
};

export default async function CampaignsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, access } = await requireFunction(slug, "mail");
  const domains = await listDomains(brand.id);
  const [addresses, unread, campaigns] = await Promise.all([listAddresses(brand.id, domains), countUnread(brand.id), listCampaigns(brand.id)]);
  const canWrite = atLeast(access.mail, "edit");
  const tz = hubTz();
  const today = todayIn(tz);
  const base = `/hub/b/${slug}/mail/campaigns`;
  return (
    <MailShell slug={slug} active={null} unread={unread} addresses={addresses} canCompose={atLeast(access.mail, "edit")} campaigns>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-title text-h2 text-ink-800">Campaigns</h1>
        {canWrite && (
          <Link href={`${base}/new`} className={btnCls("primary", "md")}>
            <Plus className="size-5" aria-hidden />
            New campaign
          </Link>
        )}
      </div>
      {campaigns.length === 0 ? (
        <EmptyState icon={<Megaphone className="size-6" aria-hidden />} title="No campaigns yet" hint="Write one email, pick who gets it from your leads and clients, and send. People can unsubscribe in one click.">
          {canWrite && (
            <Link href={`${base}/new`} className={btnCls("primary", "md")}>
              Write the first one
            </Link>
          )}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link href={`${base}/${c.id}`} className={cn(cardCls(true, true), "flex flex-wrap items-center justify-between gap-3")}>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink-800">{c.name}</span>
                  <span className="block text-caption text-ink-500">
                    {c.status === "draft" ? `Edited ${fmtStamp(c.updated_at, tz, today)}` : `${c.sent} of ${c.total} sent${c.failed ? `, ${c.failed} failed` : ""} · ${fmtStamp(c.sent_at ?? c.updated_at, tz, today)}`}
                  </span>
                </span>
                <Chip tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Chip>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </MailShell>
  );
}
