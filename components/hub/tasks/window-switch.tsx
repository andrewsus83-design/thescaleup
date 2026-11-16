import Link from "next/link";
import { segItem, segWrap } from "@/components/brand/styles";
import { cn } from "@/lib/utils";

export const WINDOWS = [7, 30, 90] as const;
export type Days = (typeof WINDOWS)[number];
export const parseDays = (v: string | undefined): Days => (WINDOWS as readonly number[]).includes(Number(v)) ? (Number(v) as Days) : 30;

/** "Last 7 / 30 / 90 days" as links, so the chosen window is in the URL. */
export function WindowSwitch({ href, days }: { href: string; days: Days }) {
  return (
    <nav aria-label="Time window" className={cn(segWrap, "max-w-full")}>
      {WINDOWS.map((d) => (
        <Link key={d} href={`${href}?d=${d}`} aria-current={d === days ? "page" : undefined} className={segItem(d === days)}>
          {d} days
        </Link>
      ))}
    </nav>
  );
}
