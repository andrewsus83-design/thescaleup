import Link from "next/link";
import { FileText, Send, Download, Trash2, Database } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { PageHeader, Card, EmptyState, Th, Td } from "@/components/admin/ui";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { sendReport, deleteReport } from "@/lib/admin/actions";

export const dynamic = "force-dynamic";

type Member = { id: string; business: string | null; name: string | null };

export default async function ReportsPage() {
  const user = await requireAdmin();

  if (!isSupabaseAdminConfigured()) {
    return (
      <>
        <PageHeader title="Report" />
        <EmptyState icon={<Database className="h-5 w-5" />} title="Supabase belum terkonfigurasi" />
      </>
    );
  }

  const db = createSupabaseAdminClient();
  const { data } = await db
    .from("reports")
    .select("id, title, status, created_at, sent_at, member:leads(id, business, name)")
    .order("created_at", { ascending: false });

  const reports = data ?? [];

  return (
    <>
      <PageHeader
        title="Report"
        description="Kumpulan report yang sudah digenerate. Download atau kirim ke klien."
      />

      <Card className="overflow-hidden p-0">
        {reports.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="Belum ada report"
              hint="Report dibuat saat admin menekan “Process Now” pada member."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-white/8 bg-white/[0.02]">
                <tr>
                  <Th>Report</Th>
                  <Th>Member</Th>
                  <Th>Status</Th>
                  <Th>Dibuat</Th>
                  <Th className="text-right">Aksi</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {reports.map((r) => {
                  const member = (r.member as unknown as Member | null) ?? null;
                  return (
                    <tr key={r.id} className="hover:bg-white/[0.02]">
                      <Td>
                        <Link
                          href={`/admin/reports/${r.id}`}
                          className="flex items-center gap-2 font-medium text-slate-100 hover:text-coral"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-coral" />
                          <span className="truncate">{r.title}</span>
                        </Link>
                      </Td>
                      <Td>
                        <span className="text-slate-300">
                          {member?.business || member?.name || "—"}
                        </span>
                      </Td>
                      <Td>
                        <span
                          className={
                            r.status === "sent"
                              ? "text-good"
                              : "text-slate-400"
                          }
                        >
                          {r.status}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-slate-500">
                          {new Date(r.created_at).toLocaleDateString("id-ID")}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={`/admin/reports/${r.id}/download`}
                            className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1.5 text-xs text-slate-300 hover:bg-white/10"
                            title="Download HTML"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                          {r.status !== "sent" && (
                            <form action={sendReport.bind(null, r.id)}>
                              <button
                                className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1.5 text-xs text-slate-300 hover:bg-white/10"
                                title="Tandai terkirim"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          )}
                          {user.perms.delete && (
                            <form action={deleteReport.bind(null, r.id)}>
                              <ConfirmSubmit
                                message="Hapus report ini?"
                                title="Hapus"
                                className="inline-flex items-center rounded-md bg-bad/10 px-2 py-1.5 text-xs text-bad hover:bg-bad/20"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </ConfirmSubmit>
                            </form>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
