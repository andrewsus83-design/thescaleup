import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  XCircle,
  FileText,
  Globe,
  Database,
  ClipboardCheck,
  KanbanSquare,
  Receipt,
  Link2,
  RefreshCw,
  Plus,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { Card, StatusBadge, EmptyState } from "@/components/admin/ui";
import { MemberRowActions } from "@/components/admin/member-actions";
import { ReportStatusSelect } from "@/components/admin/report-status-select";
import { PlanBoard, type PlanItem } from "@/components/plan/plan-board";
import { invoiceBadge, DEFAULT_INVOICE_TERMS } from "@/lib/admin/plan-status";
import {
  setMemberStatus,
  saveMemberNote,
  approveMember,
  createMasterPlanFromReport,
  createInvoice,
  setInvoiceStatus,
  recyclePlan,
  updatePlanItemStatus,
} from "@/lib/admin/actions";
import { rupiah, cn } from "@/lib/utils";
import { BUILDER_DEFS } from "@/lib/builders";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  const [reportsRes, planRes, invoicesRes] = await Promise.all([
    db.from("reports").select("id, title, status, created_at, sent_at").eq("member_id", id).order("created_at", { ascending: false }),
    db.from("master_plans").select("id, title, version, status").eq("member_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("invoices").select("*").eq("member_id", id).order("created_at", { ascending: false }),
  ]);
  const reports = reportsRes.data ?? [];
  const plan = planRes.data;
  const invoices = invoicesRes.data ?? [];
  const { data: planItems } = plan
    ? await db.from("plan_items").select("*").eq("master_plan_id", plan.id).order("sort")
    : { data: [] as PlanItem[] };

  const paidReport = reports.find((r) => r.status === "paid") ?? null;
  const planSource = paidReport
    ? (await db.from("reports").select("id, content").eq("id", paidReport.id).single()).data
    : null;
  const recBuilders = ((planSource?.content as Record<string, unknown>)?.recommended_builders ?? []) as {
    builder: string;
    priority?: string;
    reason?: string;
  }[];

  const clientLink = m.access_token
    ? `https://thescaleup.xyz/dashboard/enter?t=${m.access_token}`
    : null;

  // Scope of Work preview for the invoice (auto from the master plan's items).
  const scopePreview = ((planItems ?? []) as { title: string; status: string }[])
    .filter((it) => it.status !== "rejected")
    .map((it) => it.title);

  const saveNote = async (formData: FormData) => {
    "use server";
    await saveMemberNote(id, String(formData.get("note") ?? ""));
  };
  const approve = async () => {
    "use server";
    await approveMember(id);
  };
  const makePlan = async (formData: FormData) => {
    "use server";
    const builders = formData.getAll("builders").map(String);
    await createMasterPlanFromReport(
      String(formData.get("report_id") ?? ""),
      builders,
    );
  };
  const recycle = async () => {
    "use server";
    await recyclePlan(id);
  };

  return (
    <>
      <Link href="/admin/members" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-coral">
        <ArrowLeft className="h-4 w-4" /> Semua member
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
        <div className="lg:col-span-2">
          <Card>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
              <Field label="Nama" value={m.name} />
              <Field label="Bisnis" value={m.business} />
              <Field label="WhatsApp" value={m.whatsapp ? `+62 ${m.whatsapp}` : null} />
              <Field label="Email" value={m.email} />
              <Field
                label="Website"
                value={m.website ? (
                  <a href={m.website.startsWith("http") ? m.website : `https://${m.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-coral hover:underline">
                    <Globe className="h-3.5 w-3.5" /> {m.website}
                  </a>
                ) : null}
              />
              <Field label="Instagram" value={m.instagram} />
              <Field label="TikTok" value={m.tiktok} />
              <Field label="Kompetitor 1" value={m.competitor1} />
              <Field label="Kompetitor 2" value={m.competitor2} />
              <Field label="Kategori" value={m.category} />
              <Field label="Goal" value={m.goal} />
              <Field label="Budget" value={m.budget} />
              <Field label="Bottleneck" value={m.bottleneck} />
              <Field label="Masuk" value={new Date(m.created_at).toLocaleString("id-ID")} />
            </div>
            {m.notes && (
              <div className="mt-6 rounded-xl border border-white/8 bg-obsidian/40 p-4">
                <p className="font-mono text-[0.66rem] uppercase tracking-wider text-slate-500">Catatan klien</p>
                <p className="mt-1.5 text-sm text-slate-300">{m.notes}</p>
              </div>
            )}
          </Card>

          <Card className="mt-4">
            <p className="mb-3 font-mono text-xs uppercase tracking-wider text-slate-500">Catatan admin</p>
            <form action={saveNote} className="space-y-3">
              <textarea name="note" rows={3} defaultValue={m.admin_notes ?? ""} placeholder="Catatan internal..." className="w-full resize-none rounded-xl border border-white/10 bg-obsidian/50 px-4 py-3 text-sm text-mist placeholder:text-slate-600 focus:border-coral/50 focus:outline-none" />
              <button className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10">Simpan catatan</button>
            </form>
          </Card>
        </div>

        <div className="space-y-4">
          {/* pipeline actions */}
          <Card>
            <p className="mb-3 font-mono text-xs uppercase tracking-wider text-slate-500">Pipeline</p>
            <div className="space-y-3">
              {/* 1. Approve */}
              {m.approved_at ? (
                <div className="flex items-center gap-2 rounded-lg border border-good/20 bg-good/5 px-3 py-2 text-xs text-good">
                  <ClipboardCheck className="h-4 w-4" /> Disetujui untuk analisis
                </div>
              ) : (
                <form action={approve}>
                  <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-coral/30 bg-coral/10 px-3 py-2.5 text-sm font-semibold text-coral hover:bg-coral/20">
                    <ClipboardCheck className="h-4 w-4" /> Approve untuk Analisis
                  </button>
                </form>
              )}
              {/* 2. Process (engine) */}
              <MemberRowActions id={id} status={m.status ?? "pending"} />
              <form action={setMemberStatus.bind(null, id, "rejected")}>
                <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-bad/25 bg-bad/10 px-3 py-2 text-xs font-semibold text-bad hover:bg-bad/20">
                  <XCircle className="h-3.5 w-3.5" /> Reject Member
                </button>
              </form>
              {(plan || reports.length > 0) && (
                <form action={recycle}>
                  <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5">
                    <RefreshCw className="h-3.5 w-3.5" /> Recycle plan (re-audit)
                  </button>
                </form>
              )}
            </div>
          </Card>

          {/* client access */}
          {clientLink && (
            <Card>
              <p className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-500">
                <Link2 className="h-3.5 w-3.5 text-coral" /> Akses Client
              </p>
              <p className="text-xs text-slate-500">Link login dashboard klien:</p>
              <p className="mt-1 break-all rounded-lg border border-white/8 bg-obsidian/50 px-3 py-2 font-mono text-[0.68rem] text-coral-soft">
                {clientLink}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Kode: <span className="font-mono text-slate-300">{m.access_token}</span>
              </p>
            </Card>
          )}

          {/* reports */}
          <Card>
            <p className="mb-3 font-mono text-xs uppercase tracking-wider text-slate-500">Report</p>
            {reports.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada report. Klik “Process Now”.</p>
            ) : (
              <ul className="space-y-2">
                {reports.map((r) => (
                  <li key={r.id} className="rounded-xl border border-white/8 bg-obsidian/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/admin/reports/${r.id}`} className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-coral" />
                        <span className="truncate text-sm text-slate-200">{r.title}</span>
                      </Link>
                      <ReportStatusSelect id={r.id} status={r.status ?? "draft"} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {!plan && paidReport && (
            <Card>
              <p className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-500">
                <KanbanSquare className="h-3.5 w-3.5 text-coral" /> Buat Master Plan
              </p>
              <p className="mb-3 text-xs text-slate-500">
                Report sudah <span className="text-good">Paid</span> — pilih builder
                yang akan dibangun. Rekomendasi mesin sudah dicentang.
              </p>
              <form action={makePlan} className="space-y-2">
                <input type="hidden" name="report_id" value={paidReport.id} />
                {BUILDER_DEFS.map((b) => {
                  const rec = recBuilders.find((r) => r.builder === b.slug);
                  return (
                    <label
                      key={b.slug}
                      className="flex items-start gap-2.5 rounded-lg border border-white/8 bg-obsidian/40 p-2.5"
                    >
                      <input
                        type="checkbox"
                        name="builders"
                        value={b.slug}
                        defaultChecked={!!rec}
                        className="mt-0.5 accent-coral"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-slate-200">{b.title}</span>
                          {rec?.priority && (
                            <span
                              className={cn(
                                "rounded-full border px-1.5 py-0.5 text-[0.6rem] uppercase",
                                rec.priority === "high"
                                  ? "border-coral/30 bg-coral/10 text-coral"
                                  : "border-white/15 text-slate-400",
                              )}
                            >
                              {rec.priority}
                            </span>
                          )}
                        </div>
                        {rec?.reason && (
                          <p className="mt-0.5 text-xs text-slate-500">{rec.reason}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
                <button className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-coral to-sunset px-3 py-2.5 text-sm font-semibold text-white hover:brightness-110">
                  <KanbanSquare className="h-4 w-4" /> Buat Master Plan
                </button>
              </form>
            </Card>
          )}

          {!plan && !paidReport && reports.length > 0 && (
            <Card>
              <p className="text-xs text-slate-500">
                Report harus berstatus <span className="text-good">Paid</span>{" "}
                dulu sebelum bisa dibuat Master Plan (ubah status report di atas).
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Master Plan */}
      {plan && (
        <div className="mt-6">
          <div className="mb-4 flex items-center gap-2">
            <KanbanSquare className="h-4 w-4 text-coral" />
            <h2 className="font-display text-lg font-bold text-mist">{plan.title}</h2>
            <span className="font-mono text-xs text-slate-500">v{plan.version}</span>
          </div>
          <PlanBoard items={(planItems ?? []) as PlanItem[]} onUpdate={updatePlanItemStatus} />
        </div>
      )}

      {/* Invoices */}
      <div className="mt-6">
        <div className="mb-4 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-coral" />
          <h2 className="font-display text-lg font-bold text-mist">Invoice</h2>
        </div>
        <Card className="mb-4">
          <form action={createInvoice} className="space-y-3">
            <input type="hidden" name="member_id" value={id} />
            {plan && <input type="hidden" name="master_plan_id" value={plan.id} />}
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <label>
                <span className="mb-1.5 block text-xs text-slate-400">Deskripsi</span>
                <input name="description" defaultValue="Paket Scale-Up" className="w-full rounded-xl border border-white/10 bg-obsidian/50 px-3.5 py-2.5 text-sm text-mist focus:border-coral/50 focus:outline-none" />
              </label>
              <label>
                <span className="mb-1.5 block text-xs text-slate-400">Jumlah (Rp)</span>
                <input name="amount" type="number" min="0" placeholder="1499000" className="w-full rounded-xl border border-white/10 bg-obsidian/50 px-3.5 py-2.5 text-sm text-mist focus:border-coral/50 focus:outline-none sm:w-36" />
              </label>
              <label>
                <span className="mb-1.5 block text-xs text-slate-400">Jatuh tempo</span>
                <input name="due_date" type="date" className="rounded-xl border border-white/10 bg-obsidian/50 px-3.5 py-2.5 text-sm text-mist focus:border-coral/50 focus:outline-none" />
              </label>
            </div>

            {/* Scope of Work — apa yang ScaleUp kerjakan */}
            <div>
              <span className="mb-1.5 block text-xs text-slate-400">
                Scope of Work — tugas yang akan ScaleUp kerjakan
              </span>
              {scopePreview.length > 0 && (
                <div className="mb-2 rounded-xl border border-white/8 bg-obsidian/40 p-3 text-xs text-slate-400">
                  Otomatis dari Master Plan ({scopePreview.length} tugas). Biarkan kolom di bawah
                  kosong untuk memakai daftar ini, atau tulis manual (satu tugas per baris).
                  <ul className="mt-2 space-y-1">
                    {scopePreview.slice(0, 6).map((t, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-coral" />
                        {t}
                      </li>
                    ))}
                    {scopePreview.length > 6 && (
                      <li className="text-slate-600">+{scopePreview.length - 6} tugas lainnya…</li>
                    )}
                  </ul>
                </div>
              )}
              <textarea
                name="scope"
                rows={3}
                placeholder={
                  scopePreview.length
                    ? "Kosongkan untuk memakai daftar dari Master Plan di atas"
                    : "Satu tugas per baris:\nDesain ulang landing page\nSetup WhatsApp funnel & auto-reply\nKalender konten 30 hari"
                }
                className="w-full resize-y rounded-xl border border-white/10 bg-obsidian/50 px-3.5 py-2.5 text-sm text-mist placeholder:text-slate-600 focus:border-coral/50 focus:outline-none"
              />
            </div>

            {/* Terms & Conditions */}
            <label className="block">
              <span className="mb-1.5 block text-xs text-slate-400">Terms &amp; Conditions</span>
              <textarea
                name="terms"
                rows={7}
                defaultValue={DEFAULT_INVOICE_TERMS}
                className="w-full resize-y rounded-xl border border-white/10 bg-obsidian/50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-300 focus:border-coral/50 focus:outline-none"
              />
            </label>

            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-coral to-sunset px-5 text-sm font-semibold text-white hover:brightness-110">
              <Plus className="h-4 w-4" /> Buat Invoice
            </button>
          </form>
        </Card>

        {invoices.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada invoice.</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => {
              const scope = (inv.scope ?? []) as string[];
              return (
                <Card key={inv.id} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm text-slate-200">{inv.number}</p>
                      <p className="text-xs text-slate-500">
                        {rupiah(Number(inv.amount))}
                        {inv.due_date ? ` · jatuh tempo ${inv.due_date}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs ${invoiceBadge(inv.status)}`}>
                        {inv.status}
                      </span>
                      {inv.status !== "sent" && inv.status !== "paid" && (
                        <form action={setInvoiceStatus.bind(null, inv.id, "sent")}>
                          <button className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10">Kirim</button>
                        </form>
                      )}
                      {inv.status !== "paid" && (
                        <form action={setInvoiceStatus.bind(null, inv.id, "paid")}>
                          <button className="rounded-lg border border-good/25 bg-good/10 px-3 py-1.5 text-xs font-semibold text-good hover:bg-good/20">
                            Tandai Lunas
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                  {(scope.length > 0 || inv.terms) && (
                    <details className="rounded-xl border border-white/8 bg-obsidian/40 p-3 text-xs">
                      <summary className="cursor-pointer select-none text-slate-400 hover:text-slate-200">
                        Scope of Work &amp; Terms
                      </summary>
                      {scope.length > 0 && (
                        <div className="mt-3">
                          <p className="font-mono text-[0.62rem] uppercase tracking-wider text-slate-500">
                            Scope of Work
                          </p>
                          <ul className="mt-1.5 space-y-1 text-slate-300">
                            {scope.map((t, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-coral" />
                                {t}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {inv.terms && (
                        <div className="mt-3">
                          <p className="font-mono text-[0.62rem] uppercase tracking-wider text-slate-500">
                            Terms &amp; Conditions
                          </p>
                          <pre className="mt-1.5 whitespace-pre-wrap font-sans leading-relaxed text-slate-400">
                            {inv.terms}
                          </pre>
                        </div>
                      )}
                    </details>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
