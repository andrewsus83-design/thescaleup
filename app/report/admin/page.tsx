import { LayoutGrid } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { loadReportView, type ReportSearch } from "@/lib/report/view";
import { PerformanceView } from "@/components/report/performance-view";
import { ReportActions } from "@/components/report/report-actions";
import { AdminBottomNav } from "@/components/report/admin-bottom-nav";

export const dynamic = "force-dynamic";

/** The Report screen of report.thescaleup.xyz. The body is shared with the Chat Room (Project → Report): see PerformanceView. */
export default async function ReportAdminDashboard({ searchParams }: { searchParams: Promise<ReportSearch> }) {
  const admin = await requireAdmin();
  const view = await loadReportView(await searchParams);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 pt-8 sm:px-8">
      {/* header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#2A2870] text-white">
            <LayoutGrid className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#1B2A4A]">ScaleUp Reports</h1>
            <p className="text-sm text-slate-500">Report analytics per akun · {admin.email}</p>
          </div>
        </div>
        {/* top right: Setting · Tambah */}
        <ReportActions addMode={view.addMode} />
      </div>

      <PerformanceView view={view} basePath="/report/admin" />

      <AdminBottomNav accountIds={view.accountIds} webIds={view.webIds} active="report" />
    </div>
  );
}
