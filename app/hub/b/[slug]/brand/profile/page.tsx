import type { Metadata } from "next";
import Link from "next/link";
import { Alert, PageHeader } from "@/components/brand/primitives";
import { cardCls } from "@/components/brand/styles";
import { ProfileEditor } from "@/components/hub/brand/profile-editor";
import { requireFunction } from "@/lib/hub/access";
import { getProfile } from "@/lib/hub/brand-profile/data";
import { atLeast } from "@/lib/hub/permissions";
import { hasAiKey } from "@/lib/hub/tasks/data";

export const metadata: Metadata = { title: "Brand · Profile" };
export const dynamic = "force-dynamic";
// Reading the sources and drafting the answers can take a minute.
export const maxDuration = 120;

export default async function BrandProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, access } = await requireFunction(slug, "brand");
  const [profile, hasKey] = await Promise.all([getProfile(brand.id), hasAiKey(brand.id)]);
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <PageHeader
        title="Brand profile"
        description="What the brand sells, who buys it, where, and what counts as a lead or a sale. Fill it in by hand, or let the AI draft it from the brand's website and social accounts."
        action={
          <Link href={`/hub/b/${slug}/brand`} className="text-small font-semibold text-brand-700 underline underline-offset-4">
            Back to Brand
          </Link>
        }
      />
      {profile ? (
        <div className={cardCls()}>
          <ProfileEditor
            brandId={brand.id}
            canEdit={atLeast(access.brand, "edit")}
            hasKey={hasKey}
            version={profile.version}
            initial={profile.value}
            wikiHref={atLeast(access.wiki, "edit") ? `/hub/b/${slug}/wiki/build` : null}
          />
        </div>
      ) : (
        <Alert tone="bad">The profile could not be read. Reload the page, and if it keeps happening, tell the person who looks after the hub.</Alert>
      )}
    </div>
  );
}
