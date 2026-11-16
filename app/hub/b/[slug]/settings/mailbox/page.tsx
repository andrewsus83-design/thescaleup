import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Mail } from "lucide-react";
import { EmptyState } from "@/components/brand/primitives";
import { SettingsShell } from "@/components/hub/settings-shell";
import { canManageTeam } from "@/lib/hub/rules";
import { requireBrand } from "@/lib/hub/session";

export const metadata: Metadata = { title: "Mailbox" };
export const dynamic = "force-dynamic";

export default async function MailboxPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { actor } = await requireBrand(slug);
  if (!canManageTeam(actor)) notFound();
  return (
    <SettingsShell slug={slug} title="Mailbox" description="Manage the brand's email addresses in one place, like a cPanel: addresses, forwarding and the DNS records the domain needs.">
      <EmptyState icon={<Mail className="size-6" aria-hidden />} title="Coming next" hint="Planned on Resend: mail sent to this brand's addresses lands in its Inbox, and replies go out from the same address. The DNS records, addresses and forwarding will be managed here." />
    </SettingsShell>
  );
}
