import Link from "next/link";
import { CheckCheck, Inbox, Megaphone, PenSquare, Send } from "lucide-react";
import { btnCls, iconBtnCls, motion } from "@/components/brand/styles";
import { mailHref, type Folder } from "@/lib/hub/mail/model";
import { cn } from "@/lib/utils";

const FOLDERS: { id: Folder; label: string; Icon: typeof Inbox }[] = [
  { id: "inbox", label: "Inbox", Icon: Inbox },
  { id: "sent", label: "Sent", Icon: Send },
  { id: "done", label: "Done", Icon: CheckCheck },
];

const item = (active: boolean) => cn("flex h-11 shrink-0 items-center gap-3 whitespace-nowrap rounded-full px-4 text-small", motion, active ? "bg-brand-50 font-bold text-ink-900" : "font-medium text-ink-800 hover:bg-paper-100");

/**
 * The frame of every Mail page, laid out like Gmail: a Compose button and folders down the left on a wide screen, the same folders as
 * a scrolling row on a phone (with a round Compose button above the tab bar). Pass `active` null when no folder is open (a search, the writing page); `campaigns` marks the Campaigns pages.
 */
export function MailShell({ slug, active, unread, addresses, addressId, canCompose, fab, campaigns, children }: { slug: string; active: Folder | null; unread: number; addresses: { id: string; local_part: string }[]; addressId?: string; canCompose: boolean; fab?: boolean; campaigns?: boolean; children: React.ReactNode }) {
  const base = `/hub/b/${slug}/mail`;
  return (
    <div className="md:grid md:grid-cols-[13.5rem_minmax(0,1fr)] md:items-start md:gap-8">
      <aside className="mb-4 md:mb-0">
        {canCompose && (
          <div className="mb-4 hidden md:block">
            <Link href={`${base}/new`} className={cn(btnCls("primary", "lg"), "w-full")}>
              <PenSquare className="size-5" aria-hidden />
              Compose
            </Link>
          </div>
        )}
        <nav aria-label="Folders" className="-mx-1 flex gap-2 overflow-x-auto px-1 md:mx-0 md:flex-col md:gap-1 md:overflow-visible md:px-0">
          {FOLDERS.map(({ id, label, Icon }) => (
            <Link key={id} href={mailHref(base, id, { addressId })} aria-current={active === id ? "page" : undefined} className={item(active === id)}>
              <Icon className="size-5" aria-hidden />
              {label}
              {id === "inbox" && unread > 0 && (
                <span className="ml-auto pl-2 text-caption font-bold">
                  {unread}
                  <span className="sr-only"> unread</span>
                </span>
              )}
            </Link>
          ))}
          <Link href={`${base}/campaigns`} aria-current={campaigns ? "page" : undefined} className={item(!!campaigns)}>
            <Megaphone className="size-5" aria-hidden />
            Campaigns
          </Link>
        </nav>
        {addresses.length > 1 && (
          <nav aria-label="Addresses" className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 md:mx-0 md:mt-6 md:flex-col md:gap-1 md:overflow-visible md:px-0">
            <p className="hidden px-4 pb-1 text-caption font-semibold text-ink-500 md:block">Addresses</p>
            <Link href={mailHref(base, active ?? "inbox")} aria-current={!addressId ? "page" : undefined} className={cn(item(!addressId), "h-9 text-caption")}>
              All
            </Link>
            {addresses.map((a) => (
              <Link key={a.id} href={mailHref(base, active ?? "inbox", { addressId: a.id })} aria-current={addressId === a.id ? "page" : undefined} className={cn(item(addressId === a.id), "h-9 text-caption")}>
                <span className="truncate">{a.local_part}</span>
              </Link>
            ))}
          </nav>
        )}
      </aside>
      <div className="min-w-0">{children}</div>
      {fab && canCompose && (
        <Link href={`${base}/new`} aria-label="Compose" className={cn(iconBtnCls("primary"), "fixed right-5 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 size-14 shadow-raised md:hidden")}>
          <PenSquare className="size-6" aria-hidden />
        </Link>
      )}
    </div>
  );
}
