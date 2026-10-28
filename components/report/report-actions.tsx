import Link from "next/link";
import { Sparkles, SlidersHorizontal, LogOut } from "lucide-react";
import { RefreshButton } from "@/components/report/refresh-button";
import { btnCls } from "@/components/brand/styles";

/**
 * The buttons at the top right of the Report screen: Analytic, report Setting, reload, log out.
 * The standalone page shows all; the Chat Room (`embedded`) leaves out Logout and Analytic (brand
 * creation is only via the Room intake, so Tambah is removed from both).
 */
export function ReportActions({ addMode, embedded = false }: { addMode: boolean; embedded?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {!embedded && (
        <Link href="/report/admin/analytic" className={btnCls("secondary", "sm", "gap-2")} title="Buka Analytic">
          <Sparkles className="size-4" aria-hidden /> Analytic
        </Link>
      )}
      <Link href="/report/admin/report-settings" className={btnCls("secondary", "sm", "gap-2")} title="Setting template & rumus report">
        <SlidersHorizontal className="size-4" aria-hidden /> Setting
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
