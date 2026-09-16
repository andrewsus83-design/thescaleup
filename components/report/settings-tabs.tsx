import Link from "next/link";
import { SlidersHorizontal, Users } from "lucide-react";

/** Sub-navigation for the Settings area: Report | User. */
export function SettingsTabs({ active }: { active: "report" | "user" }) {
  const tabs = [
    { key: "report", label: "Report", href: "/report/admin/report-settings", icon: SlidersHorizontal },
    { key: "user", label: "User", href: "/report/admin/users", icon: Users },
  ] as const;
  return (
    <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active === t.key ? "bg-[#2A2870] text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Icon className="h-4 w-4" /> {t.label}
          </Link>
        );
      })}
    </div>
  );
}
