"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Save,
  Loader2,
  ExternalLink,
  Monitor,
  Smartphone,
} from "lucide-react";
import {
  BLOCK_DEFS,
  blockDef,
  newBlock,
  type WebBlock,
  type WebBlockType,
  type WebsiteDoc,
} from "@/lib/builders/website/schema";
import { BlockView } from "@/components/builders/website/block-view";
import { WEBSITE_TEMPLATES, templateDoc } from "@/lib/builders/website/templates";
import { cn } from "@/lib/utils";

type SaveFn = (
  memberId: string,
  builder: string,
  data: Record<string, unknown>,
  status?: string,
) => Promise<{ ok: boolean; error?: string }>;

const inputCls =
  "w-full rounded-lg border border-white/10 bg-obsidian/50 px-3 py-2 text-sm text-mist placeholder:text-slate-600 focus:border-coral/50 focus:outline-none";

export function WebsiteBuilder({
  memberId,
  initialDoc,
  onSave,
}: {
  memberId: string;
  initialDoc: WebsiteDoc;
  onSave: SaveFn;
}) {
  const [doc, setDoc] = useState<WebsiteDoc>(initialDoc);
  const [pageId, setPageId] = useState<string>(initialDoc.pages[0]?.id ?? "");
  const [selected, setSelected] = useState<string | null>(
    initialDoc.pages[0]?.blocks[0]?.id ?? null,
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const page = doc.pages.find((p) => p.id === pageId) ?? doc.pages[0];
  const blocks = page?.blocks ?? [];
  const sel = blocks.find((b) => b.id === selected) ?? null;
  const selDef = sel ? blockDef(sel.type) : null;

  const setBlocks = (next: WebBlock[]) =>
    setDoc((d) => ({
      ...d,
      pages: d.pages.map((p) => (p.id === page.id ? { ...p, blocks: next } : p)),
    }));

  const switchPage = (id: string) => {
    setPageId(id);
    const pg = doc.pages.find((p) => p.id === id);
    setSelected(pg?.blocks[0]?.id ?? null);
  };
  const applyTemplate = (id: string) => {
    if (!id) return;
    if (!window.confirm("Ganti semua halaman dengan template ini? Isi saat ini akan ditimpa.")) return;
    const next = templateDoc(id, doc.theme.brand);
    if (!next) return;
    setDoc(next);
    setPageId(next.pages[0]?.id ?? "");
    setSelected(next.pages[0]?.blocks[0]?.id ?? null);
  };

  const addBlock = (type: WebBlockType) => {
    const b = newBlock(type);
    setBlocks([...blocks, b]);
    setSelected(b.id);
  };
  const removeBlock = (id: string) => {
    const next = blocks.filter((b) => b.id !== id);
    setBlocks(next);
    if (selected === id) setSelected(next[0]?.id ?? null);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    const next = [...blocks];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    setBlocks(next);
  };
  const setProp = (key: string, value: unknown) => {
    if (!sel) return;
    setBlocks(blocks.map((b) => (b.id === sel.id ? { ...b, props: { ...b.props, [key]: value } } : b)));
  };
  const listItems = (key: string): Record<string, string>[] => {
    const v = sel?.props[key];
    return Array.isArray(v) ? (v as Record<string, string>[]) : [];
  };
  const setListItem = (key: string, idx: number, itemKey: string, value: string) => {
    setProp(key, listItems(key).map((it, i) => (i === idx ? { ...it, [itemKey]: value } : it)));
  };

  const save = (status: string) =>
    start(async () => {
      const r = await onSave(memberId, "website", { ...doc, website_url: `/site/${memberId}` }, status);
      if (!r.ok && r.error) window.alert(r.error);
      else setSavedAt(new Date().toLocaleTimeString("id-ID"));
    });

  return (
    <div>
      {/* toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-card/40 p-3">
        <input
          value={doc.theme.brand}
          onChange={(e) => setDoc((d) => ({ ...d, theme: { ...d.theme, brand: e.target.value } }))}
          placeholder="Nama brand"
          className={cn(inputCls, "w-32")}
        />
        <select
          value=""
          onChange={(e) => { applyTemplate(e.target.value); e.currentTarget.value = ""; }}
          className={cn(inputCls, "w-40")}
          title="Mulai dari template siap pakai"
        >
          <option value="">Pakai template…</option>
          {WEBSITE_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id} className="bg-obsidian">{t.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Warna
          <input
            type="color"
            value={doc.theme.primary}
            onChange={(e) => setDoc((d) => ({ ...d, theme: { ...d.theme, primary: e.target.value } }))}
            className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
          />
        </label>
        <input
          value={doc.theme.whatsapp ?? ""}
          onChange={(e) => setDoc((d) => ({ ...d, theme: { ...d.theme, whatsapp: e.target.value } }))}
          placeholder="WhatsApp"
          className={cn(inputCls, "w-36")}
        />
        <div className="inline-flex rounded-lg border border-white/10 p-0.5">
          <button onClick={() => setDevice("desktop")} className={cn("rounded-md p-1.5", device === "desktop" ? "bg-coral text-white" : "text-slate-400")} title="Desktop">
            <Monitor className="h-4 w-4" />
          </button>
          <button onClick={() => setDevice("mobile")} className={cn("rounded-md p-1.5", device === "mobile" ? "bg-coral text-white" : "text-slate-400")} title="Mobile">
            <Smartphone className="h-4 w-4" />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {savedAt && <span className="text-xs text-good">Tersimpan {savedAt}</span>}
          <a href={`/site/${memberId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10">
            <ExternalLink className="h-3.5 w-3.5" /> Preview
          </a>
          <button onClick={() => save("draft")} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:opacity-50">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Draft
          </button>
          <button onClick={() => save("submitted")} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-coral to-sunset px-3 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan &amp; Publish
          </button>
        </div>
      </div>

      {/* page tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {doc.pages.map((p) => (
          <button
            key={p.id}
            onClick={() => switchPage(p.id)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              p.id === pageId ? "border-coral/50 bg-coral/10 text-coral" : "border-white/10 text-slate-400 hover:bg-white/5",
            )}
          >
            {p.name || "Home"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[180px_1fr_300px]">
        {/* palette */}
        <div className="rounded-2xl border border-white/8 bg-card/40 p-3">
          <p className="mb-2 font-mono text-[0.62rem] uppercase tracking-wider text-slate-500">Tambah Blok</p>
          <div className="flex flex-col gap-1.5">
            {BLOCK_DEFS.map((d) => (
              <button key={d.type} onClick={() => addBlock(d.type)} title={d.hint} className="flex items-center gap-2 rounded-lg border border-white/8 bg-obsidian/40 px-2.5 py-2 text-left text-xs text-slate-300 hover:border-coral/30 hover:text-white">
                <Plus className="h-3.5 w-3.5 text-coral" /> {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* canvas */}
        <div className="overflow-hidden rounded-2xl border border-white/8 bg-slate-200/5 p-4">
          <div className={cn("mx-auto overflow-hidden rounded-xl bg-white shadow-2xl transition-all", device === "mobile" ? "max-w-[390px]" : "max-w-full")}>
            {blocks.length === 0 ? (
              <div className="p-16 text-center text-sm text-slate-400">Halaman kosong — tambah blok dari kiri.</div>
            ) : (
              blocks.map((b, i) => (
                <div
                  key={b.id}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragEnter={() => setOverIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragIndex !== null && overIndex !== null) move(dragIndex, overIndex); setDragIndex(null); setOverIndex(null); }}
                  onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                  onClick={() => setSelected(b.id)}
                  className={cn(
                    "group relative cursor-pointer",
                    selected === b.id && "ring-2 ring-coral ring-inset",
                    overIndex === i && dragIndex !== null && dragIndex !== i && "ring-2 ring-sky-400 ring-inset",
                  )}
                >
                  <div className={cn("absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg bg-slate-900/85 p-1 opacity-0 transition-opacity group-hover:opacity-100", selected === b.id && "opacity-100")}>
                    <span className="cursor-grab px-1 text-slate-400" title="Geser untuk urutkan"><GripVertical className="h-4 w-4" /></span>
                    <button onClick={(e) => { e.stopPropagation(); move(i, i - 1); }} className="rounded p-1 text-slate-300 hover:bg-white/10" title="Naik"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); move(i, i + 1); }} className="rounded p-1 text-slate-300 hover:bg-white/10" title="Turun"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); removeBlock(b.id); }} className="rounded p-1 text-red-300 hover:bg-red-500/20" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="pointer-events-none">
                    <BlockView block={b} theme={doc.theme} ctx={{ memberId }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* inspector */}
        <div className="rounded-2xl border border-white/8 bg-card/40 p-3">
          {!sel || !selDef ? (
            <p className="text-sm text-slate-500">Pilih blok di kanvas untuk mengedit.</p>
          ) : (
            <div className="space-y-3">
              <p className="font-mono text-[0.62rem] uppercase tracking-wider text-coral">Edit: {selDef.label}</p>
              {selDef.fields.map((f) => (
                <label key={f.key} className="block">
                  <span className="mb-1 block text-xs text-slate-400">{f.label}</span>
                  {f.kind === "textarea" ? (
                    <textarea rows={3} value={String(sel.props[f.key] ?? "")} onChange={(e) => setProp(f.key, e.target.value)} className={cn(inputCls, "resize-none")} />
                  ) : (
                    <input value={String(sel.props[f.key] ?? "")} onChange={(e) => setProp(f.key, e.target.value)} placeholder={f.kind === "image" ? "https://…/gambar.jpg" : ""} className={inputCls} />
                  )}
                </label>
              ))}

              {selDef.lists.map((ld) => (
                <div key={ld.key} className="border-t border-white/8 pt-3">
                  <p className="mb-2 text-xs font-semibold text-slate-300">{ld.label}</p>
                  <div className="space-y-2.5">
                    {listItems(ld.key).map((it, idx) => (
                      <div key={idx} className="rounded-lg border border-white/8 bg-obsidian/40 p-2.5">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[0.66rem] text-slate-500">{ld.itemLabel} {idx + 1}</span>
                          <button onClick={() => setProp(ld.key, listItems(ld.key).filter((_, i) => i !== idx))} className="text-red-300 hover:text-red-200" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                        {ld.itemFields.map((itf) =>
                          itf.kind === "textarea" ? (
                            <textarea key={itf.key} rows={2} value={String(it[itf.key] ?? "")} onChange={(e) => setListItem(ld.key, idx, itf.key, e.target.value)} placeholder={itf.label} className={cn(inputCls, "mb-1.5 resize-y")} />
                          ) : (
                            <input key={itf.key} value={String(it[itf.key] ?? "")} onChange={(e) => setListItem(ld.key, idx, itf.key, e.target.value)} placeholder={itf.label} className={cn(inputCls, "mb-1.5")} />
                          ),
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setProp(ld.key, [...listItems(ld.key), { ...ld.itemDefault }])} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10">
                    <Plus className="h-3.5 w-3.5" /> Tambah {ld.itemLabel}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
