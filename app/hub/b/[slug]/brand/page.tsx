import type { Metadata } from "next";
import { Bell, ClipboardList, HeartPulse, History, Lightbulb } from "lucide-react";
import { PageHeader } from "@/components/brand/primitives";
import { SectionList } from "@/components/hub/section-list";
import { requireFunction } from "@/lib/hub/access";
import { getProfile } from "@/lib/hub/brand-profile/data";
import { PROFILE_TOTAL, filledCount } from "@/lib/hub/brand-profile/model";

export const metadata: Metadata = { title: "Brand" };
export const dynamic = "force-dynamic";

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand } = await requireFunction(slug, "brand");
  const profile = await getProfile(brand.id);
  const answered = profile ? filledCount(profile.value) : 0;
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title={brand.name} description="Where the brand stands and what to do next." />
      <SectionList
        items={[
          {
            key: "profile",
            title: "Profile",
            hint: `What you sell, who buys it, and what counts as a lead or a sale. ${answered} of ${PROFILE_TOTAL} answered. Fill it in by hand or with AI`,
            icon: ClipboardList,
            href: `/hub/b/${slug}/brand/profile`,
          },
          { key: "chronicle", title: "Chronicle", hint: "The brand's story over time: launches, campaigns, changes and results", icon: History, soon: true },
          { key: "health", title: "Health", hint: "How the brand is doing right now, and what is pulling it down", icon: HeartPulse, soon: true },
          { key: "tips", title: "Tips", hint: "Next steps worth taking, ranked by impact", icon: Lightbulb, soon: true },
          { key: "updates", title: "Updates", hint: "What changed since you last looked", icon: Bell, soon: true },
        ]}
      />
    </div>
  );
}
