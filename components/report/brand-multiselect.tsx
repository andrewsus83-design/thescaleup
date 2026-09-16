"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, Layers } from "lucide-react";

type Brand = { id: string; name: string };

/** Multi-select account/brand picker — tick several to see a combined report. */
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
      ? brands.find((b) => b.id === selectedIds[0])?.name ?? "Pilih akun"
      : `Gabungan · ${selectedIds.length} akun`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-2.5 text-sm font-semibold text-[#1B2A4A] hover:bg-slate-50"
      >
        {selectedIds.length > 1 && <Layers className="h-3.5 w-3.5 text-[#2A2870]" />}
        {label}
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 max-h-72 w-60 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Centang akun (gabungan)
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
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
