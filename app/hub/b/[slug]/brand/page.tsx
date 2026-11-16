import type { Metadata } from "next";
import { Bell, HeartPulse, History, Lightbulb } from "lucide-react";
import { PageHeader } from "@/components/brand/primitives";
import { SectionList } from "@/components/hub/section-list";
import { requireFunction } from "@/lib/hub/access";

export const metadata: Metadata = { title: "Brand" };
export const dynamic = "force-dynamic";

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand } = await requireFunction(slug, "brand");
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title={brand.name} description="Where the brand stands and what to do next." />
      <SectionList
        items={[
          { key: "chronicle", title: "Chronicle", hint: "The brand's story over time: launches, campaigns, changes and results", icon: History, soon: true },
          { key: "health", title: "Health", hint: "How the brand is doing right now, and what is pulling it down", icon: HeartPulse, soon: true },
          { key: "tips", title: "Tips", hint: "Next steps worth taking, ranked by impact", icon: Lightbulb, soon: true },
          { key: "updates", title: "Updates", hint: "What changed since you last looked", icon: Bell, soon: true },
        ]}
      />
    </div>
  );
}
