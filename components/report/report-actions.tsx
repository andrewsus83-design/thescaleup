import Link from "next/link";
import { Plus, SlidersHorizontal, LogOut } from "lucide-react";
import { RefreshButton } from "@/components/report/refresh-button";

/**
 * The buttons at the top right of the Report screen: report Setting, add a brand, reload the account list, log out.
 * The standalone page shows them all; the Chat Room (`embedded`) opens the two pages in a new tab and leaves out
 * Logout, which is in its own menu.
 */
export function ReportActions({ addMode, embedded = false }: { addMode: boolean; embedded?: boolean }) {
  const out = embedded ? { target: "_blank", rel: "noreferrer" } : {};
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Link
        href="/report/admin/report-settings"
        {...out}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        title="Setting template & rumus report"
      >
        <SlidersHorizontal className="h-4 w-4" /> Setting
      </Link>
      <Link
        href="/report/admin?add=1"
        {...out}
        className="inline-flex items-center gap-2 rounded-xl bg-[#2A2870] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#211f5c]"
      >
        <Plus className="h-4 w-4" /> Tambah
      </Link>
      {!addMode && <RefreshButton />}
      {!embedded && (
        // eslint-disable-next-line @next/next/no-html-link-for-pages -- /admin/logout is a route handler; the old-admin catch-all makes the rule see /admin/* as pages
        <a
          href="/admin/logout"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-red-600"
          title="Keluar dari akun admin"
        >
          <LogOut className="h-4 w-4" /> Logout
        </a>
      )}
    </div>
  );
}
