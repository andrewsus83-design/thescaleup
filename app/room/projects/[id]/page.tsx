import { Suspense } from "react";
import { ProjectDetail } from "@/components/room/projects/project-detail";
import { RoomReport, RoomReportSkeleton } from "@/components/report/room-report";
import type { ReportSearch } from "@/lib/report/view";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * One project. The Report tab is the real report of report.thescaleup.xyz: it is rendered here, on the server, and handed to
 * the client page as a ready-made node. What it shows is picked by the URL (`?view=analytic`, `?accounts=…`, `?webs=…`).
 */
export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const { id } = await params;
  const sp = await searchParams;
  const search: ReportSearch = { account: one(sp.account), accounts: one(sp.accounts), webs: one(sp.webs), add: one(sp.add) };
  const screen = one(sp.view) === "analytic" ? "analytic" : "performance";
  // a new key shows the skeleton again while another channel or screen loads
  const key = [screen, search.accounts ?? search.account ?? "", search.webs ?? ""].join("|");

  return (
    <ProjectDetail
      id={id}
      report={
        <Suspense key={key} fallback={<RoomReportSkeleton />}>
          <RoomReport screen={screen} search={search} basePath={`/room/projects/${id}`} />
        </Suspense>
      }
    />
  );
}
