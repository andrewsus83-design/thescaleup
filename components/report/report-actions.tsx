import Link from "next/link";
import { Plus, SlidersHorizontal, LogOut } from "lucide-react";
import { RefreshButton } from "@/components/report/refresh-button";
import { btnCls } from "@/components/brand/styles";

/**
 * The buttons at the top right of the Report screen: report Setting, add a brand, reload the account list, log out.
 * The standalone page shows them all; the Chat Room (`embedded`) opens the two pages in a new tab and leaves out
 * Logout, which is in its own menu. All secondary: the one Orange button of the screen is "Tarik data".
 */
export function ReportActions({ addMode, embedded = false }: { addMode: boolean; embedded?: boolean }) {
  const out = embedded ? { target: "_blank", rel: "noreferrer" } : {};
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <Link href="/report/admin/report-settings" {...out} className={btnCls("secondary", "sm", "gap-2")} title="Setting template & rumus report">
        <SlidersHorizontal className="size-4" aria-hidden /> Setting
      </Link>
      <Link href="/report/admin?add=1" {...out} className={btnCls("secondary", "sm", "gap-2")}>
        <Plus className="size-4" aria-hidden /> Tambah
      </Link>
      {!addMode && <RefreshButton />}
      {!embedded && (
        // eslint-disable-next-line @next/next/no-html-link-for-pages -- /admin/logout is a route handler; the old-admin catch-all makes the rule see /admin/* as pages
        <a href="/admin/logout" className={btnCls("secondary", "sm", "gap-2")} title="Keluar dari akun admin">
          <LogOut className="size-4" aria-hidden /> Logout
        </a>
      )}
    </div>
  );
}
