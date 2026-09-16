"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

type Brand = { id: string; name: string };

/** Account/brand selector — sits next to the brand avatar. Picks which brand's report to view. */
export function BrandPicker({ brands, selectedId }: { brands: Brand[]; selectedId?: string }) {
  const router = useRouter();
  if (brands.length === 0) return null;
  return (
    <div className="relative">
      <select
        value={selectedId ?? ""}
        onChange={(e) => router.push(`/report/admin?client=${e.target.value}`)}
        className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-sm font-semibold text-[#1B2A4A] outline-none focus:border-[#2A2870]"
        aria-label="Pilih akun / brand"
      >
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
