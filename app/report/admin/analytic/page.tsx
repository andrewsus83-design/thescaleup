import { pageX } from "@/components/brand/styles";
import { requireAdmin } from "@/lib/admin/auth";
import { loadReportView, type ReportSearch } from "@/lib/report/view";
import { cn } from "@/lib/utils";
import { AnalyticView } from "@/components/report/analytic-view";

export const dynamic = "force-dynamic";

/** The Analytic screen of report.thescaleup.xyz (score · tips · research). The body is shared with the Chat Room: see AnalyticView. */
export default async function AnalyticPage({ searchParams }: { searchParams: Promise<ReportSearch> }) {
  await requireAdmin();
  const view = await loadReportView(await searchParams, "analytic");

  return (
    <div className={cn("mx-auto max-w-6xl pb-28 pt-8 sm:pt-12", pageX)}>
      <AnalyticView view={view} reportHref="/report/admin" />
    </div>
  );
}
