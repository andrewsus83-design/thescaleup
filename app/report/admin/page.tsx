import { Logo } from "@/components/brand/logo";
import { pageX } from "@/components/brand/styles";
import { requireAdmin } from "@/lib/admin/auth";
import { loadReportView, type ReportSearch } from "@/lib/report/view";
import { cn } from "@/lib/utils";
import { PerformanceView } from "@/components/report/performance-view";
import { ReportActions } from "@/components/report/report-actions";
import { AdminBottomNav } from "@/components/report/admin-bottom-nav";

export const dynamic = "force-dynamic";

/** The Report screen of report.thescaleup.xyz. The body is shared with the Chat Room (Project → Report): see PerformanceView. */
export default async function ReportAdminDashboard({ searchParams }: { searchParams: Promise<ReportSearch> }) {
  const admin = await requireAdmin();
  const view = await loadReportView(await searchParams);

  return (
    <div className={cn("mx-auto max-w-6xl pb-28 pt-8 sm:pt-12", pageX)}>
      {/* header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-6">
        <div className="flex min-w-0 max-w-full items-center gap-4">
          <Logo variant="primary" size={44} />
          <div className="min-w-0">
            <h1 className="font-title text-h2 text-ink-800">ScaleUp Reports</h1>
            <p className="truncate text-small text-ink-500">
              Report analytics per akun · <span className="font-mono text-caption">{admin.email}</span>
            </p>
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
