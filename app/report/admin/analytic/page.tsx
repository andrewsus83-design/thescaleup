import { requireAdmin } from "@/lib/admin/auth";
import { loadReportView, type ReportSearch } from "@/lib/report/view";
import { AnalyticView } from "@/components/report/analytic-view";
import { AdminBottomNav } from "@/components/report/admin-bottom-nav";

export const dynamic = "force-dynamic";

/** The Analytic screen of report.thescaleup.xyz (score · tips · research). The body is shared with the Chat Room: see AnalyticView. */
export default async function AnalyticPage({ searchParams }: { searchParams: Promise<ReportSearch> }) {
  await requireAdmin();
  const view = await loadReportView(await searchParams, "analytic");

  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 pt-8 sm:px-8">
      <AnalyticView view={view} reportHref="/report/admin" />
      <AdminBottomNav accountIds={view.accountIds} webIds={view.webIds} active="analytic" />
    </div>
  );
}
