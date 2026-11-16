import type { Metadata } from "next";
import { Images } from "lucide-react";
import { Coming } from "@/components/hub/coming";

export const metadata: Metadata = { title: "Assets" };

export default function AssetsPage() {
  return <Coming title="Assets" icon={<Images className="size-6" aria-hidden />} hint="This brand's files and media." />;
}
