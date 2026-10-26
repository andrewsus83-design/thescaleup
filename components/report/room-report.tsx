import { requireAdmin } from "@/lib/admin/auth";
import { loadReportView, type ReportSearch } from "@/lib/report/view";
import { PerformanceView } from "@/components/report/performance-view";
import { AnalyticView } from "@/components/report/analytic-view";
import { ReportActions } from "@/components/report/report-actions";

export type ReportScreen = "performance" | "analytic";

/**
 * Project → Report in the Chat Room: the real report of report.thescaleup.xyz (Performance = its Report screen, Analytic =
 * its Analytic screen) with the same channels, snapshots and numbers, because it renders the same views from the same loader.
 * It keeps the report's own look inside a canvas of its own, so a number looks the same here and there.
 * The Room's mock projects are not linked to a report brand yet (that needs the v2 database), so the channel picker is
 * how you choose the brand and the account.
 */
export async function RoomReport({ screen, search, basePath }: { screen: ReportScreen; search: ReportSearch; basePath: string }) {
  // The Room layout already gates the page, but a layout and its page render side by side: this one reads real client
  // data, so it checks the admin itself (the standalone report pages do the same).
  await requireAdmin();
  const view = await loadReportView(search, screen === "analytic" ? "analytic" : "report");
  return (
    // On a phone the Room's menu rail already takes 72px, so the canvas runs edge to edge (-mx-5 undoes the page padding).
    <div className="-mx-5 rounded-none bg-[#F4F5FB] px-3 py-4 font-body text-[#1B2A4A] sm:mx-0 sm:rounded-card sm:p-6">
      {screen === "performance" ? (
        <>
          <div className="mb-5">
            <ReportActions addMode={view.addMode} embedded />
          </div>
          <PerformanceView view={view} basePath={basePath} embedded />
        </>
      ) : (
        <AnalyticView view={view} reportHref={basePath} />
      )}
    </div>
  );
}

/** Shown while the report loads: the Zernio account list is fetched live, so the first paint can take a moment. */
export function RoomReportSkeleton() {
  return (
    <div role="status" aria-label="Loading the report" className="-mx-5 space-y-4 rounded-none bg-[#F4F5FB] px-3 py-4 sm:mx-0 sm:rounded-card sm:p-6">
      <div className="h-[76px] animate-pulse rounded-2xl bg-white" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
      <span className="sr-only">Loading the report…</span>
    </div>
  );
}
