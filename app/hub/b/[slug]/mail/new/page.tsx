import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { EmptyState } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { Composer } from "@/components/hub/mail/forms";
import { MailShell } from "@/components/hub/mail/shell";
import { requireFunction } from "@/lib/hub/access";
import { countUnread, listAddresses, listDomains, sendable } from "@/lib/hub/mail/data";
import { canManageTeam } from "@/lib/hub/rules";

export const metadata: Metadata = { title: "Compose" };
export const dynamic = "force-dynamic";

export default async function NewMailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor } = await requireFunction(slug, "mail", "edit");
  const domains = await listDomains(brand.id);
  const [all, unread] = await Promise.all([listAddresses(brand.id, domains), countUnread(brand.id)]);
  const from = sendable(all, domains);
  return (
    <MailShell slug={slug} active={null} unread={unread} addresses={all} canCompose={false}>
      <h1 className="sr-only">Compose</h1>
      {from.length === 0 ? (
        <EmptyState icon={<Mail className="size-6" aria-hidden />} title="No address to send from" hint={canManageTeam(actor) ? "Verify a domain and add an address first." : "The founder needs to verify a domain and add an address first."}>
          {canManageTeam(actor) && (
            <Link href={`/hub/b/${slug}/settings/mailbox`} className={btnCls("primary", "md")}>
              Set up the mailbox
            </Link>
          )}
        </EmptyState>
      ) : (
        <Composer brandId={brand.id} from={from.map((a) => ({ id: a.id, email: a.email, name: a.display_name }))} />
      )}
    </MailShell>
  );
}
