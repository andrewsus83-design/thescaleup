import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Inbox, MessagesSquare } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/brand/primitives";
import { requireFunction } from "@/lib/hub/access";

export const metadata: Metadata = { title: "Inbox" };

export const dynamic = "force-dynamic";

export default async function InboxPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireFunction(slug, "inbox");
  return (
    <div className="space-y-8">
      <PageHeader title="Inbox" />
      <Link href={`/hub/b/${slug}/inbox/audit`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <Card interactive>
          <div className="flex items-center gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-paper-100 text-ink-700">
              <MessagesSquare className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink-800">Chat audit</p>
              <p className="text-small text-ink-500">Read WhatsApp, Telegram and social media conversations: who is stuck, who went quiet, what to do next.</p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-ink-300" aria-hidden />
          </div>
        </Card>
      </Link>
      <EmptyState icon={<Inbox className="size-6" aria-hidden />} title="One inbox is coming next" hint="Email, social media comments and DMs, and WhatsApp chats in one place, so audits can run on live conversations instead of uploads." />
    </div>
  );
}
