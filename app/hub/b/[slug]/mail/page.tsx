import type { Metadata } from "next";
import Link from "next/link";
import { Mail, PenSquare } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/brand/primitives";
import { btnCls, segItem, segWrap } from "@/components/brand/styles";
import { ThreadList } from "@/components/hub/mail/thread-list";
import { requireFunction } from "@/lib/hub/access";
import { listAddresses, listDomains, listThreads, sendable } from "@/lib/hub/mail/data";
import { atLeast } from "@/lib/hub/permissions";
import { canManageTeam } from "@/lib/hub/rules";
import { hubTz, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Mail" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function MailPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand, actor, access } = await requireFunction(slug, "mail");
  const status = one(sp.f) === "done" ? "done" : "open";
  const addressId = one(sp.a);
  const domains = await listDomains(brand.id);
  const addresses = await listAddresses(brand.id, domains);
  const canWrite = atLeast(access.mail, "edit");
  const canSend = canWrite && sendable(addresses, domains).length > 0;
  const base = `/hub/b/${slug}/mail`;
  const href = (f: string, a?: string) => `${base}?f=${f}${a ? `&a=${a}` : ""}`;

  if (addresses.length === 0) {
    return (
      <>
        <PageHeader title="Mail" />
        <EmptyState icon={<Mail className="size-6" aria-hidden />} title="No mailbox yet" hint={canManageTeam(actor) ? "Add the brand's domain and an address, then mail to it shows up here." : "The founder sets up the brand's email addresses. Ask them to add one."}>
          {canManageTeam(actor) && (
            <Link href={`/hub/b/${slug}/settings/mailbox`} className={btnCls("primary", "md")}>
              Set up the mailbox
            </Link>
          )}
        </EmptyState>
      </>
    );
  }

  const threads = await listThreads(brand.id, { status, addressId: addressId && addresses.some((a) => a.id === addressId) ? addressId : undefined });
  const tz = hubTz();
  const today = todayIn(tz);

  return (
    <>
      <PageHeader
        title="Mail"
        description={addresses.length === 1 ? addresses[0].email : `${addresses.length} addresses`}
        action={
          canSend ? (
            <Link href={`${base}/new`} className={btnCls("primary", "md")}>
              <PenSquare className="size-4" aria-hidden />
              Write
            </Link>
          ) : undefined
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <nav aria-label="Conversations" className={segWrap}>
          <Link href={href("open", addressId)} aria-current={status === "open" ? "page" : undefined} className={segItem(status === "open")}>
            Open
          </Link>
          <Link href={href("done", addressId)} aria-current={status === "done" ? "page" : undefined} className={segItem(status === "done")}>
            Done
          </Link>
        </nav>
        {addresses.length > 1 && (
          <nav aria-label="Address" className="flex flex-wrap gap-2">
            <Link href={href(status)} aria-current={!addressId ? "page" : undefined} className={segItem(!addressId, "sm")}>
              All
            </Link>
            {addresses.map((a) => (
              <Link key={a.id} href={href(status, a.id)} aria-current={addressId === a.id ? "page" : undefined} className={segItem(addressId === a.id, "sm")}>
                {a.local_part}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {threads.length === 0 ? (
        <EmptyState icon={<Mail className="size-6" aria-hidden />} title={status === "open" ? "Nothing waiting" : "Nothing marked done yet"} hint={status === "open" ? "New mail to the brand's addresses shows up here." : "Conversations you mark done are kept here."} />
      ) : (
        <ThreadList threads={threads} base={base} tz={tz} today={today} />
      )}
    </>
  );
}
