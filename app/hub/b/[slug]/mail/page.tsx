import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Search, X } from "lucide-react";
import { EmptyState } from "@/components/brand/primitives";
import { btnCls, iconBtnCls } from "@/components/brand/styles";
import { MailShell } from "@/components/hub/mail/shell";
import { ThreadList } from "@/components/hub/mail/thread-list";
import { requireFunction } from "@/lib/hub/access";
import { PAGE, countUnread, listAddresses, listDomains, listThreads, sendable } from "@/lib/hub/mail/data";
import { cursorOf, folderOf, mailHref, searchTerm } from "@/lib/hub/mail/model";
import { atLeast } from "@/lib/hub/permissions";
import { canManageTeam } from "@/lib/hub/rules";
import { hubTz, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Mail" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const EMPTY = {
  inbox: { title: "Nothing waiting", hint: "New mail to the brand's addresses shows up here." },
  sent: { title: "Nothing sent yet", hint: "Messages you write from here are kept here." },
  done: { title: "Nothing marked done yet", hint: "Conversations you mark done are kept here." },
} as const;

export default async function MailPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand, actor, access } = await requireFunction(slug, "mail");
  const folder = folderOf(one(sp.f));
  const q = searchTerm(one(sp.q));
  const before = cursorOf(one(sp.before));
  const domains = await listDomains(brand.id);
  const addresses = await listAddresses(brand.id, domains);
  const canWrite = atLeast(access.mail, "edit");
  const canSend = canWrite && sendable(addresses, domains).length > 0;
  const base = `/hub/b/${slug}/mail`;

  if (addresses.length === 0) {
    return (
      <>
        <h1 className="sr-only">Mail</h1>
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

  const addressId = (() => {
    const a = one(sp.a);
    return a && addresses.some((x) => x.id === a) ? a : undefined;
  })();
  const [threads, unread] = await Promise.all([listThreads(brand.id, { folder, addressId, q: q || undefined, before }), countUnread(brand.id)]);
  const tz = hubTz();
  const today = todayIn(tz);
  const here = mailHref(base, folder, { addressId, q: q || undefined, before });
  const older = threads.length === PAGE ? mailHref(base, folder, { addressId, q: q || undefined, before: threads[threads.length - 1].last_message_at }) : null;

  return (
    <MailShell slug={slug} active={q ? null : folder} unread={unread} addresses={addresses} addressId={addressId} canCompose={canSend} fab>
      <h1 className="sr-only">Mail</h1>
      <form role="search" method="get" action={base} className="relative mb-4">
        {addressId && <input type="hidden" name="a" value={addressId} />}
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-500" aria-hidden />
        <input
          type="search"
          name="q"
          defaultValue={q}
          maxLength={80}
          autoComplete="off"
          aria-label="Search mail"
          placeholder="Search mail"
          className="block h-12 w-full rounded-full border-control border-transparent bg-paper-100 pr-12 pl-12 text-body text-ink-800 outline-none placeholder:text-ink-500 focus-visible:border-ink-800 focus-visible:bg-paper-0 focus-visible:shadow-focus"
        />
        {q && (
          <Link href={mailHref(base, "inbox", { addressId })} aria-label="Clear the search" className={iconBtnCls("quiet", "absolute top-1/2 right-1 size-10 -translate-y-1/2")}>
            <X className="size-4" aria-hidden />
          </Link>
        )}
      </form>
      {q && <p className="mb-3 text-small text-ink-500">Results for “{q}” in every folder except Sent. Words in the subject, the sender and the text of the messages are searched.</p>}

      {threads.length === 0 ? (
        q ? (
          <EmptyState icon={<Search className="size-6" aria-hidden />} title="No conversations match" hint="Try fewer words, or part of an address." />
        ) : (
          <EmptyState icon={<Mail className="size-6" aria-hidden />} title={before ? "No older conversations" : EMPTY[folder].title} hint={before ? undefined : EMPTY[folder].hint} />
        )
      ) : (
        <>
          <ThreadList threads={threads} brandId={brand.id} base={base} back={here} folder={folder} tz={tz} today={today} canEdit={canWrite} />
          <div className="mt-4 flex items-center justify-between">
            {before ? (
              <Link href={mailHref(base, folder, { addressId, q: q || undefined })} className={btnCls("secondary", "xs")}>
                Newest
              </Link>
            ) : (
              <span />
            )}
            {older && (
              <Link href={older} className={btnCls("secondary", "xs")}>
                Older
              </Link>
            )}
          </div>
        </>
      )}
    </MailShell>
  );
}
