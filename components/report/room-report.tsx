import { requireAdmin } from "@/lib/admin/auth";
import { loadReportView, type ReportSearch } from "@/lib/report/view";
import { PerformanceView } from "@/components/report/performance-view";
import { AnalyticView } from "@/components/report/analytic-view";
import { ReportActions } from "@/components/report/report-actions";

export type ReportScreen = "performance" | "analytic";

/**
 * Project → Report in the Chat Room: the real report of report.thescaleup.xyz (Performance = its Report screen, Analytic =
 * its Analytic screen) with the same channels, snapshots and numbers, because it renders the same views from the same loader.
 * The views wear the brand design system themselves, so here they simply sit on the Room's Paper.
 * The Room's mock projects are not linked to a report brand yet (that needs the v2 database), so the channel picker is
 * how you choose the brand and the account.
 */
export async function RoomReport({ screen, search, basePath }: { screen: ReportScreen; search: ReportSearch; basePath: string }) {
  // The Room layout already gates the page, but a layout and its page render side by side: this one reads real client
  // data, so it checks the admin itself (the standalone report pages do the same).
  await requireAdmin();
  const view = await loadReportView(search, screen === "analytic" ? "analytic" : "report");
  return screen === "performance" ? (
    <div className="space-y-6">
      <ReportActions addMode={view.addMode} embedded />
      <PerformanceView view={view} basePath={basePath} embedded />
    </div>
  ) : (
    <AnalyticView view={view} reportHref={basePath} />
  );
}

/** Shown while the report loads: the Zernio account list is fetched live, so the first paint can take a moment. */
export function RoomReportSkeleton() {
  return (
    <div role="status" aria-label="Loading the report" className="space-y-6">
      <div className="h-40 animate-pulse rounded-card bg-paper-0" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-field bg-paper-0" />
        ))}
      </div>
      <span className="sr-only">Loading the report…</span>
    </div>
  );
}
