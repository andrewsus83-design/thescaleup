"use client";
import Link from "next/link";
import { BarChart3, Sparkles } from "lucide-react";

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

export function AdminBottomNav({ accountIds, webIds, active }: AdminBottomNavProps) {
  const q = buildQuery(accountIds, webIds);
  const tabs = [
    { id: "report" as const, label: "Report", Icon: BarChart3, href: `/report/admin${q}` },
    { id: "analytic" as const, label: "Analytic", Icon: Sparkles, href: `/report/admin/analytic${q}` },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {tabs.map(({ id, label, Icon, href }) => {
          const isActive = active === id;
          return (
            <Link
              key={id}
              href={href}
              className={`relative flex flex-1 flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors ${
                isActive ? "text-[#2A2870]" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-[30%] right-[30%] h-0.5 rounded-b-full bg-[#2A2870]" />
              )}
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
