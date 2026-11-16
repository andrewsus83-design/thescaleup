import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { BackLink } from "@/components/hub/back-link";
import { Composer } from "@/components/hub/mail/forms";
import { requireFunction } from "@/lib/hub/access";
import { listAddresses, listDomains, sendable } from "@/lib/hub/mail/data";
import { canManageTeam } from "@/lib/hub/rules";

export const metadata: Metadata = { title: "Write mail" };
export const dynamic = "force-dynamic";

export default async function NewMailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor } = await requireFunction(slug, "mail", "edit");
  const domains = await listDomains(brand.id);
  const from = sendable(await listAddresses(brand.id, domains), domains);
  return (
    <div className="mx-auto w-full max-w-3xl">
      <BackLink href={`/hub/b/${slug}/mail`}>Mail</BackLink>
      <PageHeader title="Write" />
      {from.length === 0 ? (
        <EmptyState icon={<Mail className="size-6" aria-hidden />} title="No address to send from" hint={canManageTeam(actor) ? "Verify a domain and add an address first." : "The founder needs to verify a domain and add an address first."}>
          {canManageTeam(actor) && (
            <Link href={`/hub/b/${slug}/settings/mailbox`} className={btnCls("primary", "md")}>
              Set up the mailbox
            </Link>
          )}
        </EmptyState>
      ) : (
        <Card small>
          <Composer brandId={brand.id} from={from.map((a) => ({ id: a.id, email: a.email, name: a.display_name }))} />
        </Card>
      )}
    </div>
  );
}
