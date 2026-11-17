import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Alert, Card, Chip } from "@/components/brand/primitives";
import { CampaignBuilder } from "@/components/hub/email/builder";
import { CampaignActions } from "@/components/hub/email/campaign-actions";
import { SendRunner } from "@/components/hub/email/runner";
import { MailShell } from "@/components/hub/mail/shell";
import { requireFunction } from "@/lib/hub/access";
import { builderData } from "@/lib/hub/email/builder-data";
import { getCampaign } from "@/lib/hub/email/data";
import { merge, renderEmail } from "@/lib/hub/email/model";
import { countUnread } from "@/lib/hub/mail/data";
import { atLeast } from "@/lib/hub/permissions";
import { UUID } from "@/lib/hub/tasks/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Campaign" };
export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!UUID.test(id)) notFound();
  const { brand, access } = await requireFunction(slug, "mail");
  const canWrite = atLeast(access.mail, "edit");
  const camp = await getCampaign(brand.id, id);
  if (!camp) notFound();
  const [data, unread] = await Promise.all([builderData(brand.id), countUnread(brand.id)]);
  const back = (
    <Link href={`/hub/b/${slug}/mail/campaigns`} className="mb-4 inline-flex min-h-11 items-center gap-2 text-small font-semibold text-ink-500 hover:text-ink-800">
      <ArrowLeft className="size-4" aria-hidden />
      Campaigns
    </Link>
  );

  if (camp.status === "draft") {
    if (!canWrite)
      return (
        <MailShell slug={slug} active={null} unread={unread} addresses={data.allAddresses} canCompose={false} campaigns>
          {back}
          <h1 className="mb-4 font-title text-h2 text-ink-800">{camp.name}</h1>
          <Alert tone="info">This campaign is a draft. You can read it here, but only people who can edit Mail can change or send it.</Alert>
        </MailShell>
      );
    return (
      <MailShell slug={slug} active={null} unread={unread} addresses={data.allAddresses} canCompose campaigns>
        {back}
        <h1 className="mb-6 font-title text-h2 text-ink-800">{camp.name}</h1>
        <CampaignBuilder
          brandId={brand.id}
          slug={slug}
          brandName={brand.name}
          id={camp.id}
          initial={{ name: camp.name, doc: camp.doc, addressId: camp.address_id ?? (data.addresses.length === 1 ? data.addresses[0].id : ""), audience: camp.audience }}
          addresses={data.addresses}
          templates={data.templates}
          stages={data.stages}
          tags={data.tags}
          blocker={data.blocker}
        />
        <div className="mt-10 border-t border-hairline pt-6">
          <CampaignActions brandId={brand.id} slug={slug} id={camp.id} canDelete />
        </div>
      </MailShell>
    );
  }

  // Started or finished: what happened, and for a campaign still sending, a way to carry on.
  const admin = createSupabaseAdminClient();
  const { data: failures } = camp.failed
    ? await admin.from("email_sends").select("email, error").eq("campaign_id", camp.id).eq("status", "failed").limit(5)
    : { data: [] as { email: string; error: string | null }[] };
  const { count: bounced } = await admin.from("email_sends").select("id", { count: "exact", head: true }).eq("campaign_id", camp.id).in("status", ["bounced", "complained"]);
  const preview = renderEmail(camp.doc, { first_name: "Rina", name: "Rina Wijaya", company: "Maju Jaya", brand: brand.name }, "https://example.com/unsubscribe").html;
  return (
    <MailShell slug={slug} active={null} unread={unread} addresses={data.allAddresses} canCompose={canWrite} campaigns>
      {back}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-title text-h2 text-ink-800">{camp.name}</h1>
        <Chip tone={camp.status === "sent" ? "ok" : "warn"}>{camp.status === "sent" ? "Sent" : "Sending"}</Chip>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
        <div className="space-y-6">
          <Card small>
            <p className="mb-4 text-small text-ink-500">Subject: {merge(camp.doc.subject, { first_name: "Rina", name: "Rina Wijaya", company: "Maju Jaya", brand: brand.name })}</p>
            {camp.status === "sending" && canWrite ? (
              <SendRunner brandId={brand.id} slug={slug} id={camp.id} total={camp.total} sent={camp.sent} failed={camp.failed} />
            ) : (
              <dl className="grid grid-cols-3 gap-4 text-small">
                <div>
                  <dt className="text-ink-500">Sent</dt>
                  <dd className="font-title text-h3 text-ink-800">{camp.sent}</dd>
                </div>
                <div>
                  <dt className="text-ink-500">Could not send</dt>
                  <dd className="font-title text-h3 text-ink-800">{camp.failed}</dd>
                </div>
                <div>
                  <dt className="text-ink-500">Bounced or complained</dt>
                  <dd className="font-title text-h3 text-ink-800">{bounced ?? 0}</dd>
                </div>
              </dl>
            )}
          </Card>
          {(failures ?? []).length > 0 && (
            <Alert tone="warn" title="Some emails could not be sent.">
              {(failures ?? []).map((f) => `${f.email}${f.error ? ` (${f.error})` : ""}`).join("; ")}
            </Alert>
          )}
          {camp.status === "sent" && <p className="text-caption text-ink-500">Bounces and complaints arrive from Resend after sending. Those people are added to the do-not-email list automatically.</p>}
          {canWrite && <CampaignActions brandId={brand.id} slug={slug} id={camp.id} canDelete={camp.status === "sent"} />}
        </div>
        <aside aria-label="What was sent">
          <iframe title="The email that was sent" sandbox="" srcDoc={preview} className="h-[640px] w-full rounded-bubble border border-hairline bg-paper-0" />
        </aside>
      </div>
    </MailShell>
  );
}
