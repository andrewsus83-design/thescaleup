import { AtSign, DatabaseZap, KeyRound, Share2, ShieldCheck, Smartphone, Users } from "lucide-react";
import { SectionList, type SectionItem } from "@/components/hub/section-list";

const SECTIONS: (Omit<SectionItem, "href"> & { manage: boolean })[] = [
  { key: "security", title: "Password and security", hint: "Set or change the password you sign in with", icon: ShieldCheck, manage: false },
  { key: "menu", title: "Phone menu", hint: "Choose the four menus on your phone's bottom bar", icon: Smartphone, manage: false },
  { key: "integrations", title: "Integrations and API keys", hint: "AI models, search, scraping, cost control and Google", icon: KeyRound, manage: true },
  { key: "social", title: "Social media connections", hint: "Connect this brand's social accounts and WhatsApp", icon: Share2, manage: true },
  { key: "clickup", title: "Import from ClickUp", hint: "Move this brand's ClickUp Docs and tasks into the Wiki and Tasks", icon: DatabaseZap, manage: true },
  { key: "team", title: "Team", hint: "People, roles and what each role can open and change", icon: Users, manage: true },
  { key: "mailbox", title: "Mailbox", hint: "Addresses, forwarding and DNS for the brand's domain", icon: AtSign, manage: true, soon: true },
];

/** The sections of a brand's Settings. Anyone sees Security; the rest is for the founder and the agency. */
export function SettingsList({ slug, manage }: { slug: string; manage: boolean }) {
  const items: SectionItem[] = SECTIONS.filter((s) => manage || !s.manage).map((s) => ({ key: s.key, title: s.title, hint: s.hint, icon: s.icon, soon: s.soon, href: `/hub/b/${slug}/settings/${s.key}` }));
  return <SectionList items={items} />;
}
