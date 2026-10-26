"use client";

import { useState } from "react";
import { RefreshCw, FileSpreadsheet } from "lucide-react";
import { generateReport } from "@/lib/report/actions";
import { btnCls, inputCls, labelCls, pillCls } from "@/components/brand/styles";
import { cn } from "@/lib/utils";

const DAY = 86400000;
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Date range (Dari → Sampai) + quick presets → generate the report. "Tarik data" is the one Orange action of the screen. */
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
    <form action={generateReport} className="flex flex-wrap items-end gap-x-4 gap-y-4">
      <input type="hidden" name="id" value={clientId} />
      {accountId && <input type="hidden" name="account" value={accountId} />}
      <label className="block">
        <span className={labelCls}>Dari</span>
        <input type="date" name="since" value={since} max={until} onChange={(e) => setSince(e.target.value)} className={cn(inputCls, "w-48")} />
      </label>
      <label className="block">
        <span className={labelCls}>Sampai</span>
        <input type="date" name="until" value={until} min={since} max={today} onChange={(e) => setUntil(e.target.value)} className={cn(inputCls, "w-48")} />
      </label>
      {/* the pills and buttons sit near the field's centre line: a 48px button in a 56px field row is one grid step (4px) off the bottom, a 36px pill two (8px) */}
      <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Rentang cepat">
        {[
          { label: "30h", fn: () => preset(30) },
          { label: "90h", fn: () => preset(90) },
          { label: "Bulan ini", fn: thisMonth },
        ].map((p) => (
          <button key={p.label} type="button" onClick={p.fn} className={pillCls(false)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="mb-1 flex flex-wrap gap-3">
        <button type="submit" className={btnCls("primary", "lg")}>
          <RefreshCw className="size-4" aria-hidden /> Tarik data
        </button>
        <a
          href={`/report/admin/${clientId}/export?since=${since}&until=${until}${accountId ? `&account=${accountId}` : ""}`}
          className={btnCls("secondary", "lg")}
          title="Export Excel sesuai template & rumus di Setting"
        >
          <FileSpreadsheet className="size-4" aria-hidden /> Tarik Report
        </a>
      </div>
    </form>
  );
}
