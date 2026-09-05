"use client";

import { useTransition } from "react";
import { updatePlanStatus } from "@/lib/admin/actions";

const OPTS: [string, string][] = [
  ["planned", "Planned"],
  ["in_progress", "In Progress"],
  ["done", "Done"],
];

export function PlanStatusSelect({
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
        start(async () => updatePlanStatus(id, v));
      }}
      className="rounded-lg border border-white/10 bg-obsidian px-2 py-1 text-xs text-slate-200 focus:border-coral/50 focus:outline-none"
    >
      {OPTS.map(([v, l]) => (
        <option key={v} value={v} className="bg-obsidian">
          {l}
        </option>
      ))}
    </select>
  );
}
