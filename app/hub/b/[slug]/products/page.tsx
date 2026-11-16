import type { Metadata } from "next";
import { Package } from "lucide-react";
import { Coming } from "@/components/hub/coming";
import { requireFunction } from "@/lib/hub/access";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

export default async function ProductsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireFunction(slug, "products");
  return <Coming title="Products" icon={<Package className="size-6" aria-hidden />} hint="What the brand sells, like a marketplace listing: SKU, price, stock and variants." />;
}
