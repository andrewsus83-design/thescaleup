import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { Coming } from "@/components/hub/coming";
import { requireFunction } from "@/lib/hub/access";

export const metadata: Metadata = { title: "Inbox" };

export const dynamic = "force-dynamic";

export default async function InboxPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireFunction(slug, "inbox");
  return <Coming title="Inbox" icon={<Inbox className="size-6" aria-hidden />} hint="One inbox for this brand: email, social media comments and DMs, and WhatsApp chats, all in one place." />;
}
