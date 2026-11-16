import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { Alert } from "@/components/brand/primitives";
import { tagCls } from "@/components/brand/styles";
import { ReplyBox } from "@/components/hub/mail/forms";
import { Message } from "@/components/hub/mail/message";
import { MailShell } from "@/components/hub/mail/shell";
import { ThreadToolbar } from "@/components/hub/mail/thread-toolbar";
import { requireFunction } from "@/lib/hub/access";
import { countUnread, getThread, listAddresses, listDomains, sendable } from "@/lib/hub/mail/data";
import { mailHref } from "@/lib/hub/mail/model";
import { atLeast } from "@/lib/hub/permissions";
import { isR2Ready } from "@/lib/hub/storage/r2";
import { hubTz, todayIn } from "@/lib/hub/tasks/dates";
import { UUID } from "@/lib/hub/tasks/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Mail" };
export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: Promise<{ slug: string; threadId: string }> }) {
  const { slug, threadId } = await params;
  const { brand, access } = await requireFunction(slug, "mail");
  if (!UUID.test(threadId)) notFound();
  const found = await getThread(brand.id, threadId);
  if (!found) notFound();
  const { thread, messages } = found;
  const canWrite = atLeast(access.mail, "edit");
  if (thread.unread && canWrite) {
    // After the response: opening a conversation should not wait for this write.
    after(async () => {
      await createSupabaseAdminClient().from("mail_threads").update({ unread: false }).eq("brand_id", brand.id).eq("id", threadId);
    });
  }
  const [domains, unread] = await Promise.all([listDomains(brand.id), countUnread(brand.id)]);
  const addresses = await listAddresses(brand.id, domains);
  const mine = addresses.find((a) => a.id === thread.address_id);
  const canReply = canWrite && !!mine && sendable([mine], domains).length > 0;
  const canCompose = canWrite && sendable(addresses, domains).length > 0;
  const lastIn = [...messages].reverse().find((m) => m.direction === "in");
  const replyTo = lastIn ? lastIn.from_email : messages[messages.length - 1]?.to_emails.join(", ");
  const tz = hubTz();
  const today = todayIn(tz);
  const base = `/hub/b/${slug}/mail`;
  const folder = thread.status === "done" ? "done" : "inbox";
  const back = mailHref(base, folder);

  return (
    <MailShell slug={slug} active={folder} unread={Math.max(0, unread - (thread.unread && canWrite && thread.status === "open" ? 1 : 0))} addresses={addresses} canCompose={canCompose}>
      <ThreadToolbar brandId={brand.id} threadId={thread.id} status={thread.status} back={back} canEdit={canWrite} />
      <div className="mb-5">
        <h1 className="break-words font-title text-h2 text-ink-800">{thread.subject || "(no subject)"}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <span className={tagCls}>{thread.status === "done" ? "Done" : "Inbox"}</span>
          <span className="min-w-0 truncate font-mono text-micro text-ink-500">{thread.mailbox}</span>
        </p>
      </div>
      <div className="space-y-3">
        {messages.map((m, i) => (
          <Message key={m.id} m={m} slug={slug} tz={tz} today={today} open={i === messages.length - 1} />
        ))}
      </div>
      <div className="mt-6">
        {canReply ? (
          <ReplyBox brandId={brand.id} threadId={thread.id} replyTo={replyTo} canAttach={isR2Ready()} />
        ) : canWrite ? (
          <Alert tone="info">{mine ? `${mine.domain} is not verified, so this conversation cannot be answered yet.` : "The address of this conversation was removed, so it cannot be answered from here."}</Alert>
        ) : (
          <Alert tone="info">You can read this conversation but not reply to it.</Alert>
        )}
      </div>
    </MailShell>
  );
}
