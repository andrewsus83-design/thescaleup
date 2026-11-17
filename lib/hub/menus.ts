import { isTabKey, type TabKey } from "./tabs";

/** The menu a brand page belongs to, from its address: /hub/b/<brand> is Home, /hub/b/<brand>/ads/history is Ads. null outside a brand. */
export function menuFromPath(pathname: string): TabKey | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "hub" || parts[1] !== "b" || !parts[2]) return null;
  const seg = parts[3];
  if (!seg) return "home";
  return isTabKey(seg) ? seg : null;
}
