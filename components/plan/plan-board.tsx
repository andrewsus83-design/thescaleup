"use client";

import { useTransition } from "react";
import { PLAN_ITEM_STATUSES, PLAN_CATEGORIES } from "@/lib/admin/plan-status";
import { cn } from "@/lib/utils";

export type PlanItem = {
  id: string;
  title: string;
  detail?: string | null;
  category?: string | null;
  phase?: string | null;
  priority?: string | null;
  status: string;
  due_date?: string | null;
};

const priorityDot: Record<string, string> = {
  high: "bg-bad",
  medium: "bg-warn",
  low: "bg-slate-500",
};

function Item({
  item,
  onUpdate,
}: {
  item: PlanItem;
  onUpdate: (id: string, status: string) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  return (
    <div
      className={cn(
        "rounded-xl border border-white/8 bg-card/60 p-3.5 transition-opacity",
        pending && "opacity-50",
      )}
    >
      <p className="text-sm font-medium leading-snug text-slate-200">
        {item.title}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[0.66rem]">
        {item.category && item.category !== "general" && (
          <span className="rounded-full border border-coral/25 bg-coral/10 px-2 py-0.5 font-mono uppercase text-coral-soft">
            {PLAN_CATEGORIES[item.category] ?? item.category}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-slate-500">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              priorityDot[item.priority ?? "medium"] ?? "bg-slate-500",
            )}
          />
          {item.priority ?? "medium"}
        </span>
        {item.due_date && (
          <span className="font-mono text-slate-500">{item.due_date}</span>
        )}
      </div>
      <select
        value={item.status}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          start(() => onUpdate(item.id, v));
        }}
        className="mt-3 w-full rounded-lg border border-white/10 bg-obsidian/60 px-2 py-1.5 text-xs text-slate-300 focus:border-coral/50 focus:outline-none"
      >
        {PLAN_ITEM_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PlanBoard({
  items,
  onUpdate,
}: {
  items: PlanItem[];
  onUpdate: (id: string, status: string) => Promise<void>;
}) {
  if (!items.length) {
    return (
      <p className="rounded-2xl border border-dashed border-white/10 bg-card/20 px-6 py-12 text-center text-sm text-slate-500">
        Belum ada item plan. Master plan akan muncul di sini setelah dibuat dari
        report.
      </p>
    );
  }
  return (
    <div className="flex gap-4 overflow-x-auto pb-3">
      {PLAN_ITEM_STATUSES.map((col) => {
        const colItems = items.filter((i) => i.status === col.value);
        return (
          <div key={col.value} className="w-[250px] shrink-0">
            <div className="mb-3 flex items-center justify-between">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                  col.badge,
                )}
              >
                {col.label}
              </span>
              <span className="font-mono text-xs text-slate-600">
                {colItems.length}
              </span>
            </div>
            <div className="space-y-2.5">
              {colItems.map((item) => (
                <Item key={item.id} item={item} onUpdate={onUpdate} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
