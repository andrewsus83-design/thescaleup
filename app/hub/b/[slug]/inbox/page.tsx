import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { Coming } from "@/components/hub/coming";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return <Coming title="Inbox" icon={<Inbox className="size-6" aria-hidden />} hint="Messages from this brand's connected channels, including WhatsApp." />;
}
