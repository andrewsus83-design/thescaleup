import type { Metadata } from "next";
import { Card } from "@/components/brand/primitives";
import { PhoneMenuForm } from "@/components/hub/phone-menu-form";
import { SettingsShell } from "@/components/hub/settings-shell";
import { accessFor } from "@/lib/hub/access";
import { getPhoneTabs } from "@/lib/hub/prefs";
import { requireBrand } from "@/lib/hub/session";
import { phoneLayout, visibleTabs, type TabKey } from "@/lib/hub/tabs";

export const metadata: Metadata = { title: "Phone menu" };
export const dynamic = "force-dynamic";

const LABEL: Record<TabKey, string> = { brand: "Brand", tasks: "Tasks", inbox: "Inbox", mail: "Mail", social: "Social Media", content: "Content", wiki: "Wiki", assets: "Assets", team: "Team", finance: "Finance", products: "Products", settings: "Settings" };

export default async function PhoneMenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, brand, actor } = await requireBrand(slug);
  const [access, chosen] = await Promise.all([accessFor(brand.id, actor), getPhoneTabs(user.id)]);
  const tabs = visibleTabs(access);
  const { bar } = phoneLayout(tabs, chosen);
  return (
    <SettingsShell slug={slug} title="Phone menu" description="On your phone the bottom bar has room for four menus. Choose the ones you use most. On a wide screen every menu shows.">
      <Card>
        <PhoneMenuForm options={tabs.map((k) => ({ key: k, label: LABEL[k] }))} current={bar} custom={chosen !== null} />
      </Card>
    </SettingsShell>
  );
}
