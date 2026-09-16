"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, Layers, Share2, Globe, Users } from "lucide-react";

type Brand = { id: string; name: string; web?: boolean; social?: boolean };

/** Client picker (accordion) — sits left of Tambah. Tick clients to combine;
 *  each row shows the connected channels (social media + web). */
export function BrandMultiSelect({ brands, selectedIds }: { brands: Brand[]; selectedIds: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (brands.length === 0) return null;

  function go(ids: string[]) {
    router.push(ids.length ? `/report/admin?clients=${ids.join(",")}` : "/report/admin");
  }
  function toggle(id: string) {
    const set = new Set(selectedIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    go([...set]);
  }

  const label =
    selectedIds.length <= 1
      ? brands.find((b) => b.id === selectedIds[0])?.name ?? "Pilih client"
      : `Gabungan · ${selectedIds.length} akun`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-2.5 text-sm font-semibold text-[#1B2A4A] hover:bg-slate-50"
      >
        {selectedIds.length > 1 ? <Layers className="h-4 w-4 text-[#2A2870]" /> : <Users className="h-4 w-4 text-slate-400" />}
        {label}
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 max-h-80 w-72 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Centang client (gabungan) · channel terhubung
            </p>
            {brands.map((b) => {
              const on = selectedIds.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggle(b.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border ${
                        on ? "border-[#2A2870] bg-[#2A2870] text-white" : "border-slate-300"
                      }`}
                    >
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    {b.name}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {b.social && (
                      <span title="Social media terhubung" className="text-pink-500">
                        <Share2 className="h-4 w-4" />
                      </span>
                    )}
                    {b.web && (
                      <span title="Website terhubung" className="text-[#2A2870]">
                        <Globe className="h-4 w-4" />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
