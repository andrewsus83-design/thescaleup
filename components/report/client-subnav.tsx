import Link from "next/link";
import { segItem, segWrap } from "@/components/brand/styles";
import { cn } from "@/lib/utils";

/** Sub-navigation for a client: Overview | Setting (API). A BRAND segmented control: white pill, Ink when active. */
export function ClientSubnav({
  id,
  active,
  configuredCount = 0,
}: {
  id: string;
  active: "overview" | "settings";
  configuredCount?: number;
}) {
  const tabs = [
    { key: "overview", label: "Ringkasan", href: `/report/admin/${id}` },
    {
      key: "settings",
      label: `Setting API${configuredCount ? ` · ${configuredCount}` : ""}`,
      href: `/report/admin/${id}/settings`,
    },
  ] as const;
  return (
    <nav aria-label="Klien" className={cn(segWrap, "flex w-full sm:inline-flex sm:w-auto")}>
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} aria-current={active === t.key ? "page" : undefined} className={cn(segItem(active === t.key), "flex-1 sm:flex-none")}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
