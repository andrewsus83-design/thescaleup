import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Card, Alert, EmptyState } from "@/components/brand/primitives";
import { DomainCard } from "@/components/hub/mail/domain-card";
import { AddAddressForm, AddDomainForm, CopyButton, RemoveAddressButton } from "@/components/hub/mail/forms";
import { SettingsShell } from "@/components/hub/settings-shell";
import { listAddresses, listDomains } from "@/lib/hub/mail/data";
import { isResendReady } from "@/lib/hub/mail/resend";
import { requireMfa } from "@/lib/hub/mfa";
import { canManageTeam } from "@/lib/hub/rules";
import { requireBrand } from "@/lib/hub/session";
import { Mail } from "lucide-react";

export const metadata: Metadata = { title: "Mailbox" };
export const dynamic = "force-dynamic";

export default async function MailboxPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { actor, brand } = await requireBrand(slug);
  if (!canManageTeam(actor)) notFound();
  await requireMfa(`/hub/b/${slug}/settings/mailbox`);
  const [domains, host] = await Promise.all([listDomains(brand.id), headers().then((h) => h.get("host") ?? "")]);
  const addresses = await listAddresses(brand.id, domains);
  const hook = `https://${host}/api/mail/resend`;
  const verified = domains.filter((d) => d.status === "verified");

  return (
    <SettingsShell slug={slug} title="Mailbox" description="The brand's own email domain and addresses. Mail sent to them lands in Mail, and replies go out from the same address.">
      {!isResendReady() && (
        <Alert tone="warn" role="alert">
          Mail is not connected yet. Add <code className="font-mono">RESEND_API_KEY</code> to the server environment.
        </Alert>
      )}

      <section aria-labelledby="mb-domains" className="space-y-4">
        <h3 id="mb-domains" className="font-title text-h4 text-ink-800">
          Domains
        </h3>
        {domains.length === 0 && <p className="text-small text-ink-500">No domain yet. Add the one this brand sends from.</p>}
        {domains.map((d) => (
          <DomainCard key={d.id} brandId={brand.id} domain={d} />
        ))}
        <Card small>
          <AddDomainForm brandId={brand.id} />
        </Card>
      </section>

      <section aria-labelledby="mb-addresses" className="space-y-4">
        <h3 id="mb-addresses" className="font-title text-h4 text-ink-800">
          Addresses
        </h3>
        {verified.length === 0 ? (
          <EmptyState icon={<Mail className="size-6" aria-hidden />} title="Verify a domain first" hint="Addresses can be added once a domain has passed its DNS check." />
        ) : (
          <>
            {addresses.length > 0 && (
              <ul className="divide-y divide-ink-100 rounded-bubble border border-hairline bg-paper-0">
                {addresses.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-small font-semibold text-ink-800">{a.email}</p>
                      {a.display_name && <p className="truncate text-caption text-ink-500">{a.display_name}</p>}
                    </div>
                    <RemoveAddressButton brandId={brand.id} addressId={a.id} email={a.email} />
                  </li>
                ))}
              </ul>
            )}
            <Card small>
              <AddAddressForm brandId={brand.id} domains={verified.map((d) => ({ id: d.id, name: d.name }))} />
            </Card>
          </>
        )}
      </section>

      <section aria-labelledby="mb-hook" className="space-y-3">
        <h3 id="mb-hook" className="font-title text-h4 text-ink-800">
          Receiving mail
        </h3>
        <p className="text-small text-ink-500">
          One webhook in Resend serves every brand. In Resend, open Webhooks and add this address with the events email.received, email.sent, email.delivered, email.bounced, email.complained and email.failed. Then put its signing secret in <code className="font-mono">RESEND_WEBHOOK_SECRET</code> on the server.
        </p>
        <div className="flex items-start justify-between gap-2 rounded-field bg-paper-100 p-4">
          <code className="min-w-0 break-all font-mono text-small text-ink-800">{hook}</code>
          <CopyButton value={hook} label="webhook address" />
        </div>
        {!process.env.RESEND_WEBHOOK_SECRET && (
          <Alert tone="info">
            <code className="font-mono">RESEND_WEBHOOK_SECRET</code> is not set yet, so incoming mail and delivery updates are refused until it is.
          </Alert>
        )}
      </section>
    </SettingsShell>
  );
}
