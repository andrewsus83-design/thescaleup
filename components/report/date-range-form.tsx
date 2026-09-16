"use client";

import { useState } from "react";
import { RefreshCw, CalendarDays, FileSpreadsheet } from "lucide-react";
import { generateReport } from "@/lib/report/actions";

const DAY = 86400000;
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Flight-ticket-style date range (Dari → Sampai) + quick presets → generate report. */
export function DateRangeForm({
  clientId,
  accountId,
  defaultSince,
  defaultUntil,
  today,
}: {
  clientId: string;
  accountId?: string;
  defaultSince: string;
  defaultUntil: string;
  today: string;
}) {
  const [since, setSince] = useState(defaultSince);
  const [until, setUntil] = useState(defaultUntil);

  function preset(days: number) {
    const u = new Date(today + "T00:00:00Z");
    const s = new Date(u.getTime() - (days - 1) * DAY);
    setSince(iso(s));
    setUntil(iso(u));
  }
  function thisMonth() {
    const u = new Date(today + "T00:00:00Z");
    const s = new Date(Date.UTC(u.getUTCFullYear(), u.getUTCMonth(), 1));
    setSince(iso(s));
    setUntil(today);
  }

  return (
    <form action={generateReport} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={clientId} />
      {accountId && <input type="hidden" name="account" value={accountId} />}
      <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-1.5">
        <CalendarDays className="mb-2 ml-1 h-4 w-4 text-slate-400" />
        <label className="block">
          <span className="mb-0.5 block px-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Dari</span>
          <input
            type="date"
            name="since"
            value={since}
            max={until}
            onChange={(e) => setSince(e.target.value)}
            className="rounded-lg bg-transparent px-2 py-1 text-sm text-[#1B2A4A] outline-none"
          />
        </label>
        <span className="mb-2 text-slate-300">→</span>
        <label className="block">
          <span className="mb-0.5 block px-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Sampai</span>
          <input
            type="date"
            name="until"
            value={until}
            min={since}
            max={today}
            onChange={(e) => setUntil(e.target.value)}
            className="rounded-lg bg-transparent px-2 py-1 text-sm text-[#1B2A4A] outline-none"
          />
        </label>
      </div>
      <div className="flex gap-1">
        {[
          { label: "30h", fn: () => preset(30) },
          { label: "90h", fn: () => preset(90) },
          { label: "Bulan ini", fn: thisMonth },
        ].map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={p.fn}
            className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {p.label}
          </button>
        ))}
      </div>
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2A2870] px-4 py-2 text-sm font-semibold text-white hover:bg-[#211f5c]"
      >
        <RefreshCw className="h-4 w-4" /> Tarik data
      </button>
      <a
        href={`/report/admin/${clientId}/export?since=${since}&until=${until}${accountId ? `&account=${accountId}` : ""}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2870] px-4 py-2 text-sm font-semibold text-[#2A2870] hover:bg-[#2A2870]/5"
        title="Export Excel sesuai template & rumus di Setting"
      >
        <FileSpreadsheet className="h-4 w-4" /> Tarik Report
      </a>
    </form>
  );
}
