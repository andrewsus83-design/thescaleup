import type { Metadata } from "next";
import { Card } from "@/components/brand/primitives";
import { PasswordForm } from "@/components/hub/password-form";
import { SettingsShell } from "@/components/hub/settings-shell";
import { requireBrand } from "@/lib/hub/session";

export const metadata: Metadata = { title: "Password and security" };
export const dynamic = "force-dynamic";

export default async function SecurityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user } = await requireBrand(slug);
  return (
    <SettingsShell slug={slug} title="Password and security" description={`Signed in as ${user.email}. Your password belongs to you, not to this brand: it works on every brand you are part of.`}>
      <Card>
        <h2 className="mb-6 font-title text-h3 text-ink-800">Password</h2>
        <PasswordForm />
      </Card>
    </SettingsShell>
  );
}
