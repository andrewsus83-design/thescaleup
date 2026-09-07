import Link from "next/link";
import {
  Newspaper,
  Database,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  PlusCircle,
  AlertTriangle,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { PageHeader, Card, EmptyState, Th, Td } from "@/components/admin/ui";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { ArticleForm } from "@/components/admin/article-form";
import { setArticleStatus, deleteArticle } from "@/lib/admin/article-actions";
import { editorialArticles } from "@/lib/scalehub/data";
import { formatDate } from "@/lib/scalehub/content";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminScaleHubPage() {
  await requireAdmin();
  if (!isSupabaseAdminConfigured()) {
    return (
      <>
        <PageHeader title="ScaleHub" />
        <EmptyState
          icon={<Database className="h-5 w-5" />}
          title="Supabase belum terkonfigurasi"
        />
      </>
    );
  }

  const db = createSupabaseAdminClient();
  const [artRes, memRes] = await Promise.all([
    db.from("articles").select("*").order("created_at", { ascending: false }),
    db
      .from("leads")
      .select("id, business, name")
      .order("created_at", { ascending: false }),
  ]);
  const tableMissing = !!artRes.error;
  const rows = artRes.data ?? [];
  const memberOpts = (memRes.data ?? []).map((m) => ({
    id: m.id as string,
    label: (m.business as string) || (m.name as string) || "—",
  }));
  const editorial = editorialArticles();

  return (
    <>
      <PageHeader
        title="ScaleHub"
        description="Pusat konten publik — artikel dari ScaleUp & brand klien. Publish di sini muncul di /scalehub dan (untuk artikel klien) di dashboard klien."
      />

      {tableMissing && (
        <Card className="mb-5 border-warn/30 bg-warn/5">
          <p className="flex items-center gap-2 text-sm text-warn">
            <AlertTriangle className="h-4 w-4" /> Tabel{" "}
            <code className="font-mono">articles</code> belum ada. Jalankan migrasi{" "}
            <code className="font-mono">20260905150000_scalehub_invoice.sql</code>{" "}
            di Supabase SQL Editor. Artikel editorial ScaleUp tetap tampil di
            bawah.
          </p>
        </Card>
      )}

      {/* Create */}
      <Card className="mb-6">
        <p className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-500">
          <PlusCircle className="h-3.5 w-3.5 text-coral" /> Tulis artikel baru
        </p>
        <ArticleForm mode="create" members={memberOpts} />
      </Card>

      {/* DB articles */}
      <div className="mb-3 flex items-center gap-2">
        <Newspaper className="h-4 w-4 text-coral" />
        <h2 className="font-display text-lg font-bold text-mist">
          Artikel ({rows.length + editorial.length})
        </h2>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-white/8 bg-white/[0.02]">
              <tr>
                <Th>Judul</Th>
                <Th>Sumber</Th>
                <Th>Status</Th>
                <Th>Tanggal</Th>
                <Th className="text-right">Aksi</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-white/[0.02]">
                  <Td>
                    <span className="font-medium text-slate-100">{a.title}</span>
                    <span className="ml-2 font-mono text-xs text-slate-600">
                      /{a.slug}
                    </span>
                  </Td>
                  <Td>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 font-mono text-[0.62rem] uppercase",
                        a.author_type === "scaleup"
                          ? "border-coral/25 bg-coral/10 text-coral"
                          : "border-sky-500/25 bg-sky-500/10 text-sky-300",
                      )}
                    >
                      {a.author_type === "scaleup" ? "ScaleUp" : a.author_name || "Klien"}
                    </span>
                  </Td>
                  <Td>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs",
                        a.status === "published"
                          ? "border-good/30 bg-good/10 text-good"
                          : "border-white/15 bg-white/5 text-slate-400",
                      )}
                    >
                      {a.status === "published" ? "Published" : "Draft"}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-slate-400">
                      {formatDate(a.published_at || a.created_at)}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1.5">
                      {a.status === "published" && (
                        <a
                          href={`/scalehub/${a.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-md bg-white/5 px-2 py-1.5 text-xs text-slate-300 hover:bg-white/10"
                          title="Lihat publik"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <Link
                        href={`/admin/scalehub/${a.id}`}
                        className="inline-flex items-center rounded-md bg-white/5 px-2 py-1.5 text-xs text-slate-300 hover:bg-white/10"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      <form
                        action={setArticleStatus.bind(
                          null,
                          a.id,
                          a.status === "published" ? "draft" : "published",
                        )}
                      >
                        <button
                          className="inline-flex items-center rounded-md bg-white/5 px-2 py-1.5 text-xs text-slate-300 hover:bg-white/10"
                          title={a.status === "published" ? "Unpublish" : "Publish"}
                        >
                          {a.status === "published" ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </form>
                      <form action={deleteArticle.bind(null, a.id)}>
                        <ConfirmSubmit
                          message={`Hapus artikel "${a.title}"?`}
                          className="inline-flex items-center rounded-md bg-bad/10 px-2 py-1.5 text-xs text-bad hover:bg-bad/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </ConfirmSubmit>
                      </form>
                    </div>
                  </Td>
                </tr>
              ))}

              {editorial.map((a) => (
                <tr key={`ed-${a.slug}`} className="bg-white/[0.01]">
                  <Td>
                    <span className="font-medium text-slate-300">{a.title}</span>
                    <span className="ml-2 font-mono text-xs text-slate-600">
                      /{a.slug}
                    </span>
                  </Td>
                  <Td>
                    <span className="rounded-full border border-coral/25 bg-coral/10 px-2.5 py-0.5 font-mono text-[0.62rem] uppercase text-coral">
                      ScaleUp
                    </span>
                  </Td>
                  <Td>
                    <span className="rounded-full border border-good/30 bg-good/10 px-2.5 py-0.5 text-xs text-good">
                      Editorial
                    </span>
                  </Td>
                  <Td>
                    <span className="text-slate-400">{formatDate(a.date)}</span>
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1.5">
                      <a
                        href={`/scalehub/${a.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-md bg-white/5 px-2 py-1.5 text-xs text-slate-300 hover:bg-white/10"
                        title="Lihat publik"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <span className="text-xs text-slate-600">kode</span>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
