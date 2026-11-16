import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { Alert, Card } from "@/components/brand/primitives";
import { BackLink } from "@/components/hub/back-link";
import { Composer, ThreadStatusButton } from "@/components/hub/mail/forms";
import { Message } from "@/components/hub/mail/message";
import { requireFunction } from "@/lib/hub/access";
import { getThread, listAddresses, listDomains, sendable } from "@/lib/hub/mail/data";
import { atLeast } from "@/lib/hub/permissions";
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
  const [domains] = await Promise.all([listDomains(brand.id)]);
  const addresses = await listAddresses(brand.id, domains);
  const mine = addresses.find((a) => a.id === thread.address_id);
  const canReply = canWrite && !!mine && sendable([mine], domains).length > 0;
  const lastIn = [...messages].reverse().find((m) => m.direction === "in");
  const replyTo = lastIn ? lastIn.from_email : messages[messages.length - 1]?.to_emails.join(", ");
  const tz = hubTz();
  const today = todayIn(tz);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <BackLink href={`/hub/b/${slug}/mail${thread.status === "done" ? "?f=done" : ""}`}>Mail</BackLink>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words font-title text-h2 text-ink-800">{thread.subject || "(no subject)"}</h1>
          <p className="mt-1 truncate font-mono text-micro text-ink-500">{thread.mailbox}</p>
        </div>
        {canWrite && <ThreadStatusButton brandId={brand.id} threadId={thread.id} status={thread.status} />}
      </div>
      <div className="space-y-4">
        {messages.map((m) => (
          <Message key={m.id} m={m} slug={slug} tz={tz} today={today} />
        ))}
      </div>
      <div className="mt-8">
        {canReply ? (
          <Card small>
            <Composer brandId={brand.id} threadId={thread.id} replyTo={replyTo} />
          </Card>
        ) : canWrite ? (
          <Alert tone="info">{mine ? `${mine.domain} is not verified, so this conversation cannot be answered yet.` : "The address of this conversation was removed, so it cannot be answered from here."}</Alert>
        ) : (
          <Alert tone="info">You can read this conversation but not reply to it.</Alert>
        )}
      </div>
    </div>
  );
}
