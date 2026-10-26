import Link from "next/link";
import { SlidersHorizontal, Users } from "lucide-react";
import { segItem, segWrap } from "@/components/brand/styles";
import { cn } from "@/lib/utils";

/** Sub-navigation for the Settings area: Report | User. A BRAND segmented control: white pill, Ink when active. */
export function SettingsTabs({ active }: { active: "report" | "user" }) {
  const tabs = [
    { key: "report", label: "Report", href: "/report/admin/report-settings", icon: SlidersHorizontal },
    { key: "user", label: "User", href: "/report/admin/users", icon: Users },
  ] as const;
  return (
    <nav aria-label="Setting" className={cn(segWrap, "mb-8 flex w-full sm:inline-flex sm:w-auto")}>
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <Link key={t.key} href={t.href} aria-current={active === t.key ? "page" : undefined} className={cn(segItem(active === t.key), "flex-1 gap-2 sm:flex-none")}>
            <Icon className="size-4" aria-hidden /> {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
