import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { EmptyState } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { CampaignBuilder } from "@/components/hub/email/builder";
import { MailShell } from "@/components/hub/mail/shell";
import { requireFunction } from "@/lib/hub/access";
import { builderData } from "@/lib/hub/email/builder-data";
import { emptyDoc, parseAudience } from "@/lib/hub/email/model";
import { countUnread } from "@/lib/hub/mail/data";
import { canManageTeam } from "@/lib/hub/rules";

export const metadata: Metadata = { title: "New campaign" };
export const dynamic = "force-dynamic";

export default async function NewCampaignPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  // From the CRM list: "Email these people" arrives with the tag and the kind that were on screen.
  const start = parseAudience({ kinds: [one(sp.kind) === "lead" ? "lead" : "client"], stages: [], tags: [one(sp.tag) ?? ""] });
  const { brand, actor } = await requireFunction(slug, "mail", "edit");
  const [data, unread] = await Promise.all([builderData(brand.id), countUnread(brand.id)]);
  return (
    <MailShell slug={slug} active={null} unread={unread} addresses={data.allAddresses} canCompose campaigns>
      <h1 className="mb-6 font-title text-h2 text-ink-800">New campaign</h1>
      {data.addresses.length === 0 ? (
        <EmptyState icon={<Mail className="size-6" aria-hidden />} title="No address to send from" hint={canManageTeam(actor) ? "Verify a domain and add an address first." : "The founder needs to verify a domain and add an address first."}>
          {canManageTeam(actor) && (
            <Link href={`/hub/b/${slug}/settings/mailbox`} className={btnCls("primary", "md")}>
              Set up the mailbox
            </Link>
          )}
        </EmptyState>
      ) : (
        <CampaignBuilder
          brandId={brand.id}
          slug={slug}
          brandName={brand.name}
          initial={{ name: "", doc: emptyDoc(), addressId: data.addresses.length === 1 ? data.addresses[0].id : "", audience: start }}
          addresses={data.addresses}
          templates={data.templates}
          stages={data.stages}
          tags={data.tags}
          blocker={data.blocker}
        />
      )}
    </MailShell>
  );
}
