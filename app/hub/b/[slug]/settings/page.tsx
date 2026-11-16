import type { Metadata } from "next";
import { Card, Chip, PageHeader } from "@/components/brand/primitives";
import { SettingsList } from "@/components/hub/settings-list";
import { canManageTeam, ROLE_LABEL } from "@/lib/hub/rules";
import { requireBrand } from "@/lib/hub/session";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor } = await requireBrand(slug);
  const manage = canManageTeam(actor);
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Settings" />
      <Card className="mb-6">
        <dl className="grid gap-x-8 gap-y-3 text-body sm:grid-cols-[8rem_1fr]">
          <dt className="text-ink-500">Brand</dt>
          <dd className="text-ink-800">{brand.name}</dd>
          <dt className="text-ink-500">Address</dt>
          <dd className="font-mono text-small text-ink-800">{brand.slug}</dd>
          <dt className="text-ink-500">Website</dt>
          <dd className="truncate text-ink-800">{brand.website ?? "—"}</dd>
          <dt className="text-ink-500">Your role</dt>
          <dd>
            <Chip tone="brand">{actor === "owner" ? "Agency owner" : ROLE_LABEL[actor]}</Chip>
          </dd>
        </dl>
      </Card>
      <SettingsList slug={slug} manage={manage} />
      {!manage && <p className="mt-6 text-small text-ink-500">Team, keys and connections are managed by the founder.</p>}
    </div>
  );
}
