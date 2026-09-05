import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileText,
  Send,
  Globe,
  Database,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { Card, StatusBadge, EmptyState } from "@/components/admin/ui";
import { MemberRowActions } from "@/components/admin/member-actions";
import {
  processMember,
  setMemberStatus,
  saveMemberNote,
  sendReport,
} from "@/lib/admin/actions";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <p className="font-mono text-[0.66rem] uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm text-slate-200">{value}</p>
    </div>
  );
}

export default async function MemberDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  if (!isSupabaseAdminConfigured()) {
    return <EmptyState icon={<Database className="h-5 w-5" />} title="Supabase belum terkonfigurasi" />;
  }

  const db = createSupabaseAdminClient();
  const { data: m } = await db.from("leads").select("*").eq("id", id).single();
  if (!m) notFound();

  const { data: reports } = await db
    .from("reports")
    .select("id, title, status, created_at, sent_at")
    .eq("member_id", id)
    .order("created_at", { ascending: false });

  const saveNote = async (formData: FormData) => {
    "use server";
    await saveMemberNote(id, String(formData.get("note") ?? ""));
  };

  return (
    <>
      <Link
        href="/admin/members"
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-coral"
      >
        <ArrowLeft className="h-4 w-4" />
        Semua member
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist">
            {m.business || m.name || "—"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {m.name}
            {m.whatsapp ? ` · +62 ${m.whatsapp}` : ""}
          </p>
        </div>
        <StatusBadge status={m.status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* info */}
        <div className="lg:col-span-2">
          <Card>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
              <Field label="Nama" value={m.name} />
              <Field label="Bisnis" value={m.business} />
              <Field label="WhatsApp" value={m.whatsapp ? `+62 ${m.whatsapp}` : null} />
              <Field label="Email" value={m.email} />
              <Field
                label="Website"
                value={
                  m.website ? (
                    <a href={m.website.startsWith("http") ? m.website : `https://${m.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-coral hover:underline">
                      <Globe className="h-3.5 w-3.5" /> {m.website}
                    </a>
                  ) : null
                }
              />
              <Field label="Instagram" value={m.instagram} />
              <Field label="TikTok" value={m.tiktok} />
              <Field label="Kompetitor 1" value={m.competitor1} />
              <Field label="Kompetitor 2" value={m.competitor2} />
              <Field label="Kategori" value={m.category} />
              <Field label="Goal" value={m.goal} />
              <Field label="Budget" value={m.budget} />
              <Field label="Bottleneck" value={m.bottleneck} />
              <Field label="Sumber" value={m.source} />
              <Field
                label="Masuk"
                value={new Date(m.created_at).toLocaleString("id-ID")}
              />
            </div>
            {m.notes && (
              <div className="mt-6 rounded-xl border border-white/8 bg-obsidian/40 p-4">
                <p className="font-mono text-[0.66rem] uppercase tracking-wider text-slate-500">
                  Catatan klien
                </p>
                <p className="mt-1.5 text-sm text-slate-300">{m.notes}</p>
              </div>
            )}
          </Card>

          {/* admin notes */}
          <Card className="mt-4">
            <p className="mb-3 font-mono text-xs uppercase tracking-wider text-slate-500">
              Catatan admin
            </p>
            <form action={saveNote} className="space-y-3">
              <textarea
                name="note"
                rows={3}
                defaultValue={m.admin_notes ?? ""}
                placeholder="Catatan internal soal member ini..."
                className="w-full resize-none rounded-xl border border-white/10 bg-obsidian/50 px-4 py-3 text-sm text-mist placeholder:text-slate-600 focus:border-coral/50 focus:outline-none"
              />
              <button className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10">
                Simpan catatan
              </button>
            </form>
          </Card>
        </div>

        {/* actions + reports */}
        <div className="space-y-4">
          <Card>
            <p className="mb-3 font-mono text-xs uppercase tracking-wider text-slate-500">
              Aksi
            </p>
            <div className="space-y-3">
              <MemberRowActions id={id} status={m.status ?? "pending"} />
              <div className="grid grid-cols-2 gap-2">
                <form action={setMemberStatus.bind(null, id, "joined")}>
                  <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-good/25 bg-good/10 px-3 py-2 text-xs font-semibold text-good hover:bg-good/20">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Flag Joined
                  </button>
                </form>
                <form action={setMemberStatus.bind(null, id, "rejected")}>
                  <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-bad/25 bg-bad/10 px-3 py-2 text-xs font-semibold text-bad hover:bg-bad/20">
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                </form>
              </div>
              {m.status === "pending" && (
                <form action={processMember.bind(null, id)}>
                  <button className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-coral to-sunset px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110">
                    Process Now &amp; Build Report
                  </button>
                </form>
              )}
            </div>
          </Card>

          <Card>
            <p className="mb-3 font-mono text-xs uppercase tracking-wider text-slate-500">
              Report
            </p>
            {!reports || reports.length === 0 ? (
              <p className="text-sm text-slate-500">
                Belum ada report. Klik “Process Now” untuk membuat.
              </p>
            ) : (
              <ul className="space-y-2">
                {reports.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-obsidian/40 px-3 py-2.5"
                  >
                    <Link href={`/admin/reports/${r.id}`} className="min-w-0 flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-coral" />
                      <span className="truncate text-sm text-slate-200">{r.title}</span>
                    </Link>
                    {r.status !== "sent" ? (
                      <form action={sendReport.bind(null, r.id)}>
                        <button className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10" title="Tandai terkirim">
                          <Send className="h-3 w-3" /> Kirim
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-good">terkirim</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
