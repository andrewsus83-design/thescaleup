"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, MessageCircle } from "lucide-react";
import type { CrmContact } from "@/lib/crm/data";
import { crmAddContact, crmMoveContact, crmDeleteContact, crmSetCategory } from "@/lib/crm/actions";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full rounded-lg border border-white/10 bg-obsidian/50 px-3 py-2 text-sm text-mist placeholder:text-slate-600 focus:border-coral/50 focus:outline-none";

function rupiah(v: number | null): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  return `Rp ${v.toLocaleString("id-ID")}`;
}

function waHref(wa: string | null): string | null {
  const d = (wa ?? "").replace(/[^0-9]/g, "");
  return d ? `https://wa.me/${d}` : null;
}

export function CrmBoard({
  memberId,
  stages,
  sources,
  categories,
  contacts,
}: {
  memberId: string;
  stages: string[];
  sources: string[];
  categories: string[];
  contacts: CrmContact[];
}) {
  const router = useRouter();
  const [local, setLocal] = useState(contacts);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", whatsapp: "", source: "", value: "", stage: stages[0] ?? "", category: "" });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setLocal(contacts), [contacts]);

  const stageOf = (c: CrmContact) => (stages.includes(c.stage) ? c.stage : stages[0] ?? c.stage);

  const move = (id: string, stage: string) => {
    const cur = local.find((c) => c.id === id);
    if (!cur || cur.stage === stage) return;
    setLocal((prev) => prev.map((c) => (c.id === id ? { ...c, stage } : c)));
    start(() => void crmMoveContact(memberId, id, stage));
  };

  const del = (id: string) => {
    setLocal((prev) => prev.filter((c) => c.id !== id));
    start(() => void crmDeleteContact(memberId, id));
  };

  const setCategory = (id: string, category: string) => {
    const next = category || null;
    setLocal((prev) => prev.map((c) => (c.id === id ? { ...c, category: next } : c)));
    start(() => void crmSetCategory(memberId, id, category));
  };

  const add = () => {
    setErr(null);
    if (!form.name.trim()) { setErr("Nama wajib diisi."); return; }
    setAdding(true);
    start(async () => {
      const r = await crmAddContact(memberId, { ...form });
      setAdding(false);
      if (!r.ok) { setErr(r.error ?? "Gagal menambah kontak."); return; }
      setForm({ name: "", whatsapp: "", source: "", value: "", stage: stages[0] ?? "", category: "" });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* add contact */}
      <div className="rounded-2xl border border-white/8 bg-card/40 p-4">
        <p className="mb-3 font-mono text-xs uppercase tracking-wider text-slate-500">Tambah kontak / lead</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nama *" className={cn(inputCls, "lg:col-span-2")} />
          <input value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} placeholder="No. WhatsApp" className={inputCls} />
          <select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} className={inputCls}>
            <option value="">Sumber…</option>
            {sources.map((s) => (<option key={s} value={s} className="bg-obsidian">{s}</option>))}
          </select>
          <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputCls}>
            <option value="">Kategori…</option>
            {categories.map((c) => (<option key={c} value={c} className="bg-obsidian">{c}</option>))}
          </select>
          <input value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} placeholder="Nilai (Rp)" className={inputCls} />
          <select value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))} className={inputCls}>
            {stages.map((s) => (<option key={s} value={s} className="bg-obsidian">{s}</option>))}
          </select>
        </div>
        {err && <p className="mt-2 text-sm text-bad">{err}</p>}
        <button onClick={add} disabled={adding} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-coral to-sunset px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Tambah
        </button>
      </div>

      {/* pipeline board */}
      <div className="flex gap-3 overflow-x-auto pb-3">
        {stages.map((stage) => {
          const colItems = local.filter((c) => stageOf(c) === stage);
          const total = colItems.reduce((n, c) => n + (c.value ?? 0), 0);
          return (
            <div
              key={stage}
              onDragOver={(e) => { e.preventDefault(); setOverCol(stage); }}
              onDragLeave={() => setOverCol((c) => (c === stage ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) move(id, stage);
                setOverCol(null);
                setDragId(null);
              }}
              className={cn(
                "flex w-[260px] shrink-0 flex-col rounded-2xl border p-3 transition-colors",
                overCol === stage ? "border-coral/40 bg-coral/5" : "border-white/8 bg-surface/40",
              )}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="truncate text-sm font-semibold text-slate-200">{stage}</span>
                <span className="font-mono text-xs text-slate-600">{colItems.length}</span>
              </div>
              {total > 0 && (
                <p className="mb-2 px-1 font-mono text-[0.66rem] text-good">{rupiah(total)}</p>
              )}
              <div className="flex min-h-[60px] flex-1 flex-col gap-2">
                {colItems.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", c.id);
                      setDragId(c.id);
                    }}
                    onDragEnd={() => setDragId(null)}
                    className={cn(
                      "group cursor-grab rounded-xl border border-white/10 bg-card p-3 shadow-sm transition-all hover:border-coral/30 active:cursor-grabbing",
                      dragId === c.id && "opacity-40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug text-slate-200">{c.name}</p>
                      <button onClick={() => del(c.id)} className="text-slate-600 opacity-0 transition-opacity hover:text-bad group-hover:opacity-100" title="Hapus">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.64rem]">
                      {c.category && (
                        <span className="rounded-full border border-coral/30 bg-coral/10 px-2 py-0.5 font-medium text-coral">{c.category}</span>
                      )}
                      {c.source && (
                        <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono uppercase text-slate-400">{c.source}</span>
                      )}
                      {rupiah(c.value) && <span className="font-mono text-good">{rupiah(c.value)}</span>}
                    </div>
                    {c.whatsapp && (
                      <a
                        href={waHref(c.whatsapp) ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 inline-flex items-center gap-1 text-[0.66rem] text-slate-500 hover:text-coral"
                      >
                        <MessageCircle className="h-3 w-3" /> {c.whatsapp}
                      </a>
                    )}
                    {/* touch / accessibility fallback */}
                    <select
                      value={stageOf(c)}
                      onChange={(e) => move(c.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 w-full rounded-lg border border-white/8 bg-obsidian/60 px-2 py-1 text-[0.66rem] text-slate-400 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                    >
                      {stages.map((s) => (<option key={s} value={s}>Pindah ke: {s}</option>))}
                    </select>
                    <select
                      value={c.category ?? ""}
                      onChange={(e) => setCategory(c.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1.5 w-full rounded-lg border border-white/8 bg-obsidian/60 px-2 py-1 text-[0.66rem] text-slate-400 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                    >
                      <option value="">Kategori: —</option>
                      {categories.map((cat) => (<option key={cat} value={cat}>Kategori: {cat}</option>))}
                      {c.category && !categories.includes(c.category) && (
                        <option value={c.category}>Kategori: {c.category}</option>
                      )}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
