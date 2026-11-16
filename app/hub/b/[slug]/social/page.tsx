import type { Metadata } from "next";
import { Share2 } from "lucide-react";
import { Coming } from "@/components/hub/coming";

export const metadata: Metadata = { title: "Social Media" };

export default function SocialPage() {
  return <Coming title="Social Media" icon={<Share2 className="size-6" aria-hidden />} hint="Analytics for this brand&apos;s connected accounts, like the ScaleUp Report: reach, posts and followers." />;
}
