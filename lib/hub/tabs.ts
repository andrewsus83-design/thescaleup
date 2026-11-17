import type { Access, Fn } from "./permissions";

// The sections of a brand, in the order of the bottom bar on a wide screen. Home (the greeting and what needs you) is on the far left.
export const TAB_KEYS = ["home", "brand", "tasks", "inbox", "mail", "social", "ads", "content", "crm", "wiki", "assets", "team", "finance", "products", "settings"] as const;
export type TabKey = (typeof TAB_KEYS)[number];
export const isTabKey = (v: unknown): v is TabKey => typeof v === "string" && (TAB_KEYS as readonly string[]).includes(v);

// Which function's access decides whether a tab shows. Home and Settings are always there: everyone can set their own password.
const TAB_FN: Record<TabKey, Fn | null> = {
  home: null,
  brand: "brand",
  tasks: "tasks",
  inbox: "inbox",
  mail: "mail",
  social: "social",
  ads: "ads",
  content: "content",
  crm: "crm",
  wiki: "wiki",
  assets: "assets",
  team: "team",
  finance: "finance",
  products: "products",
  settings: null,
};

export function visibleTabs(access: Access): TabKey[] {
  return TAB_KEYS.filter((k) => {
    const fn = TAB_FN[k];
    return fn === null || access[fn] !== "none";
  });
}

/** A phone's bar has four menus the person picks, and a fifth "More" that holds the rest. */
export const PHONE_BAR_SLOTS = 4;

/** What the bar starts with, and what fills a free slot when a chosen menu is not available in this brand. */
export const DEFAULT_PHONE_ORDER: readonly TabKey[] = ["home", "tasks", "inbox", "team", "settings", "brand", "mail", "social", "ads", "content", "crm", "wiki", "assets", "finance", "products"];

/** The phone bar for this person in this brand: their choices that they may open, then the defaults; everything else goes under More. */
export function phoneLayout(allowed: readonly TabKey[], chosen: readonly string[] | null): { bar: TabKey[]; more: TabKey[] } {
  const ok = new Set(allowed);
  const bar: TabKey[] = [];
  for (const k of chosen ?? []) if (isTabKey(k) && ok.has(k) && !bar.includes(k) && bar.length < PHONE_BAR_SLOTS) bar.push(k);
  for (const k of DEFAULT_PHONE_ORDER) if (bar.length < PHONE_BAR_SLOTS && ok.has(k) && !bar.includes(k)) bar.push(k);
  return { bar, more: allowed.filter((k) => !bar.includes(k)) };
}
