import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { EmptyState } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { SequenceBuilder } from "@/components/hub/email/sequence-builder";
import { MailShell } from "@/components/hub/mail/shell";
import { requireFunction } from "@/lib/hub/access";
import { builderData } from "@/lib/hub/email/builder-data";
import { parseAudience } from "@/lib/hub/email/model";
import { getStages } from "@/lib/hub/crm/data";
import { closedKeys } from "@/lib/hub/crm/model";
import { countUnread } from "@/lib/hub/mail/data";
import { canManageTeam } from "@/lib/hub/rules";

export const metadata: Metadata = { title: "New sequence" };
export const dynamic = "force-dynamic";

export default async function NewSequencePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor } = await requireFunction(slug, "mail", "edit");
  const [data, unread, stages] = await Promise.all([builderData(brand.id), countUnread(brand.id), getStages(brand.id)]);
  return (
    <MailShell slug={slug} active={null} unread={unread} addresses={data.allAddresses} canCompose sequences>
      <h1 className="mb-6 font-title text-h2 text-ink-800">New sequence</h1>
      {data.addresses.length === 0 ? (
        <EmptyState icon={<Mail className="size-6" aria-hidden />} title="No address to send from" hint={canManageTeam(actor) ? "Verify a domain and add an address first." : "The founder needs to verify a domain and add an address first."}>
          {canManageTeam(actor) && (
            <Link href={`/hub/b/${slug}/settings/mailbox`} className={btnCls("primary", "md")}>
              Set up the mailbox
            </Link>
          )}
        </EmptyState>
      ) : (
        <SequenceBuilder
          brandId={brand.id}
          slug={slug}
          brandName={brand.name}
          hasPeople={false}
          initial={{ name: "", addressId: data.addresses.length === 1 ? data.addresses[0].id : "", steps: [], audience: parseAudience({}), stopStages: closedKeys(stages) }}
          addresses={data.addresses}
          stages={data.stages}
          stageOptions={stages.map((s) => ({ key: s.key, label: s.label }))}
          tags={data.tags}
          blocker={data.blocker}
        />
      )}
    </MailShell>
  );
}
