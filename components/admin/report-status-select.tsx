"use client";

import { useTransition } from "react";
import { setReportStatus } from "@/lib/admin/actions";
import { REPORT_STATUSES } from "@/lib/admin/config";
import { cn } from "@/lib/utils";

export function ReportStatusSelect({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        start(() => setReportStatus(id, v));
      }}
      className={cn(
        "rounded-lg border border-white/10 bg-obsidian/60 px-2 py-1 text-xs text-slate-300 focus:border-coral/50 focus:outline-none",
        pending && "opacity-50",
      )}
    >
      {REPORT_STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
