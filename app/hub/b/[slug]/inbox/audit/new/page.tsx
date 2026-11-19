import type { Metadata } from "next";
import Link from "next/link";
import { btnCls } from "@/components/brand/styles";
import { ConnectWizard } from "@/components/hub/chat/connect-wizard";
import { SettingsShell } from "@/components/hub/settings-shell";
import { UploadWizard } from "@/components/hub/chat/upload-wizard";
import { requireFunction } from "@/lib/hub/access";
import { brandScope } from "@/lib/hub/zernio/api";
import { hasAiKey } from "@/lib/hub/tasks/data";
import { hubTz, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "New chat audit" };
export const dynamic = "force-dynamic";

export default async function NewAuditPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { slug } = await params;
  const { mode } = await searchParams;
  const { brand } = await requireFunction(slug, "inbox", "edit");
  const hasKey = await hasAiKey(brand.id);
  const connect = mode === "connect";
  const base = `/hub/b/${slug}/inbox/audit/new`;
  const hasZernio = connect ? (await brandScope(brand.id)).ok : false;
  return (
    <SettingsShell
      slug={slug}
      title="New chat audit"
      description={connect ? "Read the conversations straight from your connected accounts. You see which dates are available before anything runs." : "Choose your chat files, say who is on your side, and run it."}
      back={{ href: `/hub/b/${slug}/inbox/audit`, label: "Chat audit" }}
    >
      <nav aria-label="Where the conversations come from" className="-mx-1 mb-6 flex flex-wrap gap-2">
        <Link href={base} aria-current={connect ? undefined : "page"} className={btnCls(connect ? "secondary" : "dark", "sm")}>
          Upload files
        </Link>
        <Link href={`${base}?mode=connect`} aria-current={connect ? "page" : undefined} className={btnCls(connect ? "dark" : "secondary", "sm")}>
          Connect (Zernio)
        </Link>
      </nav>
      {connect ? <ConnectWizard brandId={brand.id} slug={slug} hasKey={hasKey} hasZernio={hasZernio} today={todayIn(hubTz())} /> : <UploadWizard brandId={brand.id} slug={slug} hasKey={hasKey} />}
    </SettingsShell>
  );
}
