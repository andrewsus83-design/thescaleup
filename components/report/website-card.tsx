"use client";

import { Globe, Plus, ExternalLink, Search } from "lucide-react";
import { saveClientWebsite } from "@/lib/report/actions";

/** Web tracking per brand: shows the tracked site, or an empty-state to add one. */
export function WebsiteCard({ clientId, website }: { clientId: string; website: string | null }) {
  if (!website) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Globe className="h-6 w-6" />
        </span>
        <p className="font-semibold text-slate-700">Belum ada website yang di-track</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
          Masukkan alamat website brand ini untuk mulai memantau SEO / GEO (visibility di Google &amp; AI search).
        </p>
        <form action={saveClientWebsite} className="mx-auto mt-4 flex max-w-md items-stretch gap-2">
          <input type="hidden" name="id" value={clientId} />
          <input
            name="website"
            required
            placeholder="https://brand-anda.com"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2A2870]"
          />
          <button
            type="submit"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#2A2870] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#211f5c]"
          >
            <Plus className="h-4 w-4" /> Track website
          </button>
        </form>
      </div>
    );
  }

  let host = website;
  try {
    host = new URL(website).host;
  } catch {
    /* keep raw */
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2A2870]/10 text-[#2A2870]">
            <Globe className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#1B2A4A]">Website di-track</p>
            <a href={website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-[#2A2870] hover:underline">
              {host} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        <form action={saveClientWebsite} className="flex items-center gap-2">
          <input type="hidden" name="id" value={clientId} />
          <input
            name="website"
            defaultValue={website}
            className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2A2870]"
          />
          <button type="submit" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Simpan
          </button>
        </form>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <Search className="h-3.5 w-3.5" /> SEO / GEO score (DataForSEO, Firecrawl, Perplexity) — belum ditarik. Segera.
      </div>
    </div>
  );
}
