import type { Metadata } from "next";
import { Images } from "lucide-react";
import { Coming } from "@/components/hub/coming";
import { requireFunction } from "@/lib/hub/access";

export const metadata: Metadata = { title: "Assets" };

export const dynamic = "force-dynamic";

export default async function AssetsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireFunction(slug, "assets");
  return <Coming title="Assets" icon={<Images className="size-6" aria-hidden />} hint="Graphics, logos, the brand&apos;s design system and other files." />;
}
