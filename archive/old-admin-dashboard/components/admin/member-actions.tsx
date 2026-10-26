"use client";

import { useTransition } from "react";
import { Loader2, Play } from "lucide-react";
import { processMember, setMemberStatus } from "@/lib/admin/actions";
import { MEMBER_STATUSES } from "@/lib/admin/config";

export function MemberRowActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center justify-end gap-2">
      {status === "pending" && (
        <button
          onClick={() =>
            start(async () => {
              const r = await processMember(id);
              if (r && !r.ok && r.error) window.alert(r.error);
            })
          }
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-coral to-sunset px-2.5 py-1.5 text-xs font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Process Now
        </button>
      )}
      <select
        value={status}
        onChange={(e) => {
          const v = e.target.value;
          start(async () => setMemberStatus(id, v));
        }}
        disabled={pending}
        className="rounded-lg border border-white/10 bg-obsidian px-2 py-1.5 text-xs text-slate-200 focus:border-coral/50 focus:outline-none"
      >
        {MEMBER_STATUSES.map((s) => (
          <option key={s.value} value={s.value} className="bg-obsidian">
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
