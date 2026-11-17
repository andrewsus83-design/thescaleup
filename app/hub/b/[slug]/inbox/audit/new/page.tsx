import type { Metadata } from "next";
import { SettingsShell } from "@/components/hub/settings-shell";
import { UploadWizard } from "@/components/hub/chat/upload-wizard";
import { requireFunction } from "@/lib/hub/access";
import { hasAiKey } from "@/lib/hub/tasks/data";

export const metadata: Metadata = { title: "New chat audit" };
export const dynamic = "force-dynamic";

export default async function NewAuditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand } = await requireFunction(slug, "inbox", "edit");
  const hasKey = await hasAiKey(brand.id);
  return (
    <SettingsShell slug={slug} title="New chat audit" description="Choose your chat files, say who is on your side, and run it." back={{ href: `/hub/b/${slug}/inbox/audit`, label: "Chat audit" }}>
      <UploadWizard brandId={brand.id} slug={slug} hasKey={hasKey} />
    </SettingsShell>
  );
}
