import { AccentScope } from "@/components/hub/accent-scope";
import { HubBar } from "@/components/hub/frame";
import { BrandTabs } from "@/components/hub/brand-tabs";
import { accessFor } from "@/lib/hub/access";
import { getPhoneTabs } from "@/lib/hub/prefs";
import { requireBrand } from "@/lib/hub/session";
import { phoneLayout, visibleTabs } from "@/lib/hub/tabs";

export const dynamic = "force-dynamic";

export default async function BrandLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, brand, actor } = await requireBrand(slug);
  const [access, chosen] = await Promise.all([accessFor(brand.id, actor), getPhoneTabs(user.id)]);
  const tabs = visibleTabs(access);
  const { bar, more } = phoneLayout(tabs, chosen);
  return (
    <>
      <HubBar email={user.email} isOwner={user.isOwner} brandName={brand.name} />
      <AccentScope>
        {/* The bottom padding keeps the last line of a page clear of the floating menu bar. */}
        <main className="mx-auto w-full px-6 pt-4 pb-[calc(8.5rem+env(safe-area-inset-bottom))] sm:w-[90%] sm:px-0 sm:pt-6">{children}</main>
        <BrandTabs slug={brand.slug} tabs={tabs} bar={bar} more={more} />
      </AccentScope>
    </>
  );
}
