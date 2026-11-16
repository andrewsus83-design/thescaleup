import { HubBar } from "@/components/hub/frame";
import { BrandTabs } from "@/components/hub/brand-tabs";
import { requireBrand } from "@/lib/hub/session";

export const dynamic = "force-dynamic";

export default async function BrandLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, brand } = await requireBrand(slug);
  return (
    <>
      <HubBar email={user.email} isOwner={user.isOwner} brandName={brand.name} />
      <BrandTabs slug={brand.slug} />
      <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">{children}</main>
    </>
  );
}
