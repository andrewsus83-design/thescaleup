import { FileText } from "lucide-react";
import { requireClient } from "@/lib/client/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader, EmptyState } from "@/components/admin/ui";
import { ReportView } from "@/components/report/report-view";

export const dynamic = "force-dynamic";

export default async function ClientReportPage() {
  const m = await requireClient();
  const db = createSupabaseAdminClient();
  const { data: report } = await db
    .from("reports")
    .select("title, summary, content, created_at")
    .eq("member_id", m.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!report) {
    return (
      <>
        <PageHeader title="Report Audit" />
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="Report belum tersedia"
          hint="Tim ScaleUp sedang menyiapkan audit Anda."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Report Audit" description={report.title} />
      <ReportView
        content={(report.content ?? {}) as Record<string, unknown>}
        summary={report.summary}
      />
    </>
  );
}
