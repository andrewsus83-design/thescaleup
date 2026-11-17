import { BookOpen, Building2, BriefcaseBusiness, CheckSquare, House, Images, Inbox, Mail, Megaphone, Package, PenLine, Settings, Share2, Users, Wallet, type LucideIcon } from "lucide-react";
import type { TabKey } from "@/lib/hub/tabs";

/** What each menu is called, and its icon. `short` is for a narrow bar. */
export const MENU: Record<TabKey, { label: string; short: string; icon: LucideIcon }> = {
  home: { label: "Home", short: "Home", icon: House },
  brand: { label: "Brand", short: "Brand", icon: Building2 },
  tasks: { label: "Tasks", short: "Tasks", icon: CheckSquare },
  inbox: { label: "Inbox", short: "Inbox", icon: Inbox },
  mail: { label: "Mail", short: "Mail", icon: Mail },
  social: { label: "Social Media", short: "Social", icon: Share2 },
  content: { label: "Content", short: "Content", icon: PenLine },
  crm: { label: "CRM", short: "CRM", icon: BriefcaseBusiness },
  ads: { label: "Ads", short: "Ads", icon: Megaphone },
  wiki: { label: "Wiki", short: "Wiki", icon: BookOpen },
  assets: { label: "Assets", short: "Assets", icon: Images },
  team: { label: "Team", short: "Team", icon: Users },
  finance: { label: "Finance", short: "Finance", icon: Wallet },
  products: { label: "Products", short: "Products", icon: Package },
  settings: { label: "Settings", short: "Settings", icon: Settings },
};
