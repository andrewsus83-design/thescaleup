"use client";

import { Globe, Plus, ExternalLink, Search } from "lucide-react";
import { saveClientWebsite } from "@/lib/report/actions";
import { Card, EmptyState } from "@/components/brand/primitives";
import { btnCls, inputCls } from "@/components/brand/styles";
import { cn } from "@/lib/utils";

/** Web tracking per brand: shows the tracked site, or an empty-state to add one. */
export function WebsiteCard({ clientId, website }: { clientId: string; website: string | null }) {
  if (!website) {
    return (
      <EmptyState
        icon={<Globe className="size-6" aria-hidden />}
        title="Belum ada website yang di-track"
        hint="Masukkan alamat website brand ini untuk mulai memantau SEO / GEO (visibility di Google & AI search)."
      >
        <form action={saveClientWebsite} className="mx-auto flex w-full max-w-md flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={clientId} />
          <label className="min-w-0 flex-1 basis-48">
            <span className="sr-only">Alamat website</span>
            <input name="website" required placeholder="https://brand-anda.com" className={inputCls} />
          </label>
          <button type="submit" className={btnCls("dark", "lg", "gap-2")}>
            <Plus className="size-4" aria-hidden /> Track website
          </button>
        </form>
      </EmptyState>
    );
  }

  let host = website;
  try {
    host = new URL(website).host;
  } catch {
    /* keep raw */
  }
  return (
    <Card className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-nav bg-paper-100 text-ink-800">
            <Globe className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-title text-body font-bold text-ink-800">Website di-track</p>
            <a href={website} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-small text-brand-700 underline underline-offset-4 hover:text-brand-600">
              {host} <ExternalLink className="size-4 shrink-0" aria-hidden />
            </a>
          </div>
        </div>
        <form action={saveClientWebsite} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={clientId} />
          <label className="min-w-0">
            <span className="sr-only">Alamat website</span>
            <input name="website" defaultValue={website} className={cn(inputCls, "w-full sm:w-72")} />
          </label>
          <button type="submit" className={btnCls("secondary", "lg")}>
            Simpan
          </button>
        </form>
      </div>
      <p className="flex items-center gap-3 rounded-field bg-paper-100 px-4 py-3 text-caption text-ink-500">
        <Search className="size-4 shrink-0" aria-hidden /> SEO / GEO score (DataForSEO, Firecrawl, Perplexity) — belum ditarik. Segera.
      </p>
    </Card>
  );
}
