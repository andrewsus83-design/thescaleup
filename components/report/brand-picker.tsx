"use client";

import { useRouter } from "next/navigation";
import { Plus, ChevronDown } from "lucide-react";

type Brand = { id: string; name: string };

/** Top-right control: pick a brand to view its report, or add a new one. */
export function BrandPicker({ brands, selectedId }: { brands: Brand[]; selectedId?: string }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      {brands.length > 0 && (
        <div className="relative">
          <select
            value={selectedId ?? ""}
            onChange={(e) => router.push(`/report/admin?client=${e.target.value}`)}
            className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-9 text-sm font-medium text-[#1B2A4A] outline-none focus:border-[#2A2870]"
            aria-label="Pilih brand"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      )}
      <button
        type="button"
        onClick={() => router.push("/report/admin?add=1")}
        className="inline-flex items-center gap-2 rounded-xl bg-[#2A2870] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#211f5c]"
      >
        <Plus className="h-4 w-4" /> Tambah
      </button>
    </div>
  );
}
