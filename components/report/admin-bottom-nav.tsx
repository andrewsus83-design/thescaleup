"use client";
import Link from "next/link";
import { BarChart3, Sparkles } from "lucide-react";
import { motion } from "@/components/brand/styles";
import { cn } from "@/lib/utils";

interface AdminBottomNavProps {
  accountIds: string[];
  webIds: string[];
  active: "report" | "analytic";
}

function buildQuery(accountIds: string[], webIds: string[]) {
  const p = new URLSearchParams();
  if (accountIds.length) p.set("accounts", accountIds.join(","));
  if (webIds.length) p.set("webs", webIds.join(","));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** The tab bar at the bottom of the standalone report (BRAND §5: tab bar, one column). The active tab is an Ink label on a Paper pill. */
export function AdminBottomNav({ accountIds, webIds, active }: AdminBottomNavProps) {
  const q = buildQuery(accountIds, webIds);
  const tabs = [
    { id: "report" as const, label: "Report", Icon: BarChart3, href: `/report/admin${q}` },
    { id: "analytic" as const, label: "Analytic", Icon: Sparkles, href: `/report/admin/analytic${q}` },
  ];

  return (
    <nav aria-label="Report" className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-paper-0">
      <div className="mx-auto flex max-w-6xl" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {tabs.map(({ id, label, Icon, href }) => {
          const isActive = active === id;
          return (
            <Link
              key={id}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn("flex flex-1 flex-col items-center gap-1 py-3 text-caption font-semibold", motion, isActive ? "text-ink-800" : "text-ink-500 hover:text-ink-800")}
            >
              <span className={cn("inline-flex h-8 w-14 items-center justify-center rounded-full", motion, isActive && "bg-paper-100")}>
                <Icon className="size-5" aria-hidden />
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
