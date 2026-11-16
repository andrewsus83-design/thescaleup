import type { Metadata } from "next";
import { Share2 } from "lucide-react";
import { Coming } from "@/components/hub/coming";
import { requireFunction } from "@/lib/hub/access";

export const metadata: Metadata = { title: "Social Media" };

export const dynamic = "force-dynamic";

export default async function SocialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireFunction(slug, "social");
  return <Coming title="Social Media" icon={<Share2 className="size-6" aria-hidden />} hint="Analytics for this brand&apos;s connected accounts, like the ScaleUp Report: reach, posts and followers." />;
}
