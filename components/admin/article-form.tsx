"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, CheckCircle2, AlertCircle } from "lucide-react";
import type { ArticleInput, ArticleSource } from "@/lib/scalehub/content";
import { createArticle, updateArticle } from "@/lib/admin/article-actions";
import { cn } from "@/lib/utils";

type MemberOpt = { id: string; label: string };

const inputCls =
  "w-full rounded-xl border border-white/10 bg-obsidian/50 px-3.5 py-2.5 text-sm text-mist placeholder:text-slate-600 focus:border-coral/50 focus:outline-none";

export function ArticleForm({
  mode,
  members,
  id,
  initial,
}: {
  mode: "create" | "edit";
  members: MemberOpt[];
  id?: string;
  initial?: Partial<ArticleInput>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [f, setF] = useState<ArticleInput>({
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    excerpt: initial?.excerpt ?? "",
    category: initial?.category ?? "Insight",
    authorType: (initial?.authorType as ArticleSource) ?? "scaleup",
    memberId: initial?.memberId ?? "",
    authorName: initial?.authorName ?? "",
    coverUrl: initial?.coverUrl ?? "",
    contentRaw: initial?.contentRaw ?? "",
    status: (initial?.status as "draft" | "published") ?? "draft",
    featured: initial?.featured ?? false,
  });

  const set = <K extends keyof ArticleInput>(k: K, v: ArticleInput[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  const submit = (status: "draft" | "published") => {
    setMsg(null);
    const payload = { ...f, status };
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createArticle(payload)
          : await updateArticle(id!, payload);
      if (res.ok) {
        router.push("/admin/scalehub");
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error ?? "Gagal menyimpan." });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-xs text-slate-400">Judul</span>
          <input
            value={f.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Judul artikel yang menarik & kaya kata kunci"
            className={inputCls}
          />
        </label>

        <label>
          <span className="mb-1.5 block text-xs text-slate-400">
            Slug (opsional)
          </span>
          <input
            value={f.slug}
            onChange={(e) => set("slug", e.target.value)}
            placeholder="otomatis dari judul"
            className={inputCls}
          />
        </label>

        <label>
          <span className="mb-1.5 block text-xs text-slate-400">Kategori</span>
          <input
            value={f.category}
            onChange={(e) => set("category", e.target.value)}
            placeholder="GEO / CRO / Automation / Cerita Klien"
            className={inputCls}
          />
        </label>

        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-xs text-slate-400">
            Ringkasan (excerpt)
          </span>
          <textarea
            value={f.excerpt}
            onChange={(e) => set("excerpt", e.target.value)}
            rows={2}
            placeholder="1–2 kalimat yang muncul di kartu & hasil pencarian."
            className={cn(inputCls, "resize-none")}
          />
        </label>

        <label>
          <span className="mb-1.5 block text-xs text-slate-400">Penulis</span>
          <select
            value={f.authorType}
            onChange={(e) => set("authorType", e.target.value as ArticleSource)}
            className={inputCls}
          >
            <option value="scaleup" className="bg-obsidian">
              ScaleUp (editorial)
            </option>
            <option value="client" className="bg-obsidian">
              Klien
            </option>
          </select>
        </label>

        <label>
          <span className="mb-1.5 block text-xs text-slate-400">
            Cover URL (opsional)
          </span>
          <input
            value={f.coverUrl}
            onChange={(e) => set("coverUrl", e.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
        </label>

        {f.authorType === "client" && (
          <>
            <label>
              <span className="mb-1.5 block text-xs text-slate-400">
                Member klien (attribution)
              </span>
              <select
                value={f.memberId ?? ""}
                onChange={(e) => set("memberId", e.target.value)}
                className={inputCls}
              >
                <option value="" className="bg-obsidian">
                  — pilih member —
                </option>
                {members.map((m) => (
                  <option key={m.id} value={m.id} className="bg-obsidian">
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-xs text-slate-400">
                Nama penulis tampil (opsional)
              </span>
              <input
                value={f.authorName}
                onChange={(e) => set("authorName", e.target.value)}
                placeholder="Kosongkan = pakai nama bisnis member"
                className={inputCls}
              />
            </label>
          </>
        )}
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs text-slate-400">
          Isi artikel — <span className="font-mono">## Judul bagian</span>,{" "}
          <span className="font-mono">- poin</span>, baris kosong = paragraf baru
        </span>
        <textarea
          value={f.contentRaw}
          onChange={(e) => set("contentRaw", e.target.value)}
          rows={14}
          placeholder={
            "Paragraf pembuka...\n\n## Sub-judul\nParagraf isi.\n\n- poin pertama\n- poin kedua"
          }
          className={cn(inputCls, "resize-y font-mono text-[0.8rem] leading-relaxed")}
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={f.featured}
          onChange={(e) => set("featured", e.target.checked)}
          className="h-4 w-4 accent-coral"
        />
        Tandai sebagai unggulan (featured)
      </label>

      {msg && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm",
            msg.ok
              ? "border-good/25 bg-good/10 text-good"
              : "border-bad/25 bg-bad/10 text-bad",
          )}
        >
          {msg.ok ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {msg.text}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("draft")}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/10 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Simpan Draft
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("published")}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-coral to-sunset px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Publish ke ScaleHub
        </button>
      </div>
    </div>
  );
}
