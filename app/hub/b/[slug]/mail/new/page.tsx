import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { EmptyState } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { Composer, type ForwardStart } from "@/components/hub/mail/forms";
import { MailShell } from "@/components/hub/mail/shell";
import { requireFunction } from "@/lib/hub/access";
import { countUnread, getForwardSource, listAddresses, listDomains, sendable } from "@/lib/hub/mail/data";
import { attachError } from "@/lib/hub/mail/files";
import { forwardBody, forwardDate, forwardSubject } from "@/lib/hub/mail/forward";
import { canManageTeam } from "@/lib/hub/rules";
import { isR2Ready, r2Problem } from "@/lib/hub/storage/r2";
import { hubTz } from "@/lib/hub/tasks/dates";
import { UUID } from "@/lib/hub/tasks/context";

export const metadata: Metadata = { title: "Compose" };
export const dynamic = "force-dynamic";

export default async function NewMailPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand, actor } = await requireFunction(slug, "mail", "edit");
  const domains = await listDomains(brand.id);
  const [all, unread] = await Promise.all([listAddresses(brand.id, domains), countUnread(brand.id)]);
  const from = sendable(all, domains);

  // ?fwd=<message id>: the writing page starts as a forward of that message (subject, quoted text, and its files ticked).
  let start: ForwardStart | undefined;
  const fwd = Array.isArray(sp.fwd) ? sp.fwd[0] : sp.fwd;
  if (fwd && UUID.test(fwd)) {
    const m = await getForwardSource(brand.id, fwd);
    if (m) {
      const usable = m.attachments.filter((a) => typeof a.id === "string" && a.id !== "" && !attachError(a.filename || "file", a.size ?? 1, 0, 0));
      start = {
        addressId: m.address_id ?? undefined,
        subject: forwardSubject(m.subject),
        body: forwardBody(m, forwardDate(m.occurred_at, hubTz())),
        files: usable.map((a) => ({ value: `${m.id}:${a.id}`, name: a.filename || "Attachment", size: a.size ?? 0 })),
        leftOut: m.attachments.length - usable.length,
      };
    }
  }
  return (
    <MailShell slug={slug} active={null} unread={unread} addresses={all} canCompose={false}>
      <h1 className="sr-only">{start ? "Forward" : "Compose"}</h1>
      {from.length === 0 ? (
        <EmptyState icon={<Mail className="size-6" aria-hidden />} title="No address to send from" hint={canManageTeam(actor) ? "Verify a domain and add an address first." : "The founder needs to verify a domain and add an address first."}>
          {canManageTeam(actor) && (
            <Link href={`/hub/b/${slug}/settings/mailbox`} className={btnCls("primary", "md")}>
              Set up the mailbox
            </Link>
          )}
        </EmptyState>
      ) : (
        <Composer brandId={brand.id} canAttach={isR2Ready()} attachHint={canManageTeam(actor) ? (r2Problem() ?? undefined) : undefined} from={from.map((a) => ({ id: a.id, email: a.email, name: a.display_name }))} start={start} />
      )}
    </MailShell>
  );
}
