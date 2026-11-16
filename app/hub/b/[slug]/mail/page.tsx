import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { Coming } from "@/components/hub/coming";
import { requireFunction } from "@/lib/hub/access";

export const metadata: Metadata = { title: "Mail" };
export const dynamic = "force-dynamic";

export default async function MailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireFunction(slug, "mail");
  return <Coming title="Mail" icon={<Mail className="size-6" aria-hidden />} hint="Email only: read, reply and send from this brand's own addresses. The domain and the addresses are set up under Settings, Mailbox." />;
}
