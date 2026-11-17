import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MessagesSquare, Plus } from "lucide-react";
import { Alert, Card, EmptyState, PageHeader } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { requireFunction } from "@/lib/hub/access";
import { listAudits } from "@/lib/hub/chat/data";
import { atLeast } from "@/lib/hub/permissions";
import { fmtStamp, hubTz, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Chat audit" };
export const dynamic = "force-dynamic";

export default async function AuditListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, access } = await requireFunction(slug, "inbox");
  const { rows, ready } = await listAudits(brand.id);
  const tz = hubTz();
  const today = todayIn(tz);
  const canRun = atLeast(access.inbox, "edit");
  return (
    <div className="w-full space-y-8">
      <Link href={`/hub/b/${slug}/inbox`} className="inline-flex min-h-11 items-center gap-2 text-small font-semibold text-ink-500 hover:text-ink-800">
        Inbox
      </Link>
      <PageHeader
        title="Chat audit"
        description="Upload WhatsApp, Telegram or social media conversations. Claude reads them, the hub counts the response times, and you get follow-ups, partnership health and a ghosting report, with buttons to turn them into tasks, CRM notes and content."
        action={
          canRun ? (
            <Link href={`/hub/b/${slug}/inbox/audit/new`} className={btnCls("primary", "md")}>
              <Plus className="size-4" aria-hidden />
              New audit
            </Link>
          ) : undefined
        }
      />
      {!ready && <Alert tone="warn">Chat audit needs its database step first (20261117310000_chat_audit.sql). Ask the person who runs the database updates.</Alert>}
      {ready && rows.length === 0 ? (
        <EmptyState icon={<MessagesSquare className="size-6" aria-hidden />} title="No audits yet" hint="Export a chat, upload it, and see where each conversation stands." />
      ) : (
        <ul className="space-y-2">
          {rows.map((a) => (
            <li key={a.id}>
              <Link href={`/hub/b/${slug}/inbox/audit/${a.id}`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                <Card small interactive>
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink-800">{a.name}</p>
                      <p className="text-small text-ink-500">
                        {a.conversations} {a.conversations === 1 ? "conversation" : "conversations"}, {fmtStamp(a.created_at, tz, today)}
                      </p>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-ink-300" aria-hidden />
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
