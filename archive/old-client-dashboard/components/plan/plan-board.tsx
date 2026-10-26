"use client";

import { useEffect, useState, useTransition } from "react";
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

function Card({
  item,
  onDragStart,
  onDragEnd,
  onMove,
  dragging,
}: {
  item: PlanItem;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (status: string) => void;
  dragging: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group cursor-grab rounded-xl border border-white/10 bg-card p-3 shadow-sm transition-all hover:border-coral/30 active:cursor-grabbing",
        dragging && "opacity-40",
      )}
    >
      <p className="text-sm font-medium leading-snug text-slate-200">
        {item.title}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[0.64rem]">
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
      {/* touch / accessibility fallback */}
      <select
        value={item.status}
        onChange={(e) => onMove(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="mt-2.5 w-full rounded-lg border border-white/8 bg-obsidian/60 px-2 py-1 text-[0.66rem] text-slate-400 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 sm:opacity-0"
      >
        {PLAN_ITEM_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            Pindah ke: {s.label}
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
  const [local, setLocal] = useState(items);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    setLocal(items);
  }, [items]);

  function move(id: string, status: string) {
    const cur = local.find((i) => i.id === id);
    if (!cur || cur.status === status) return;
    setLocal((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    start(() => onUpdate(id, status));
  }

  if (!items.length) {
    return (
      <p className="rounded-2xl border border-dashed border-white/10 bg-card/20 px-6 py-12 text-center text-sm text-slate-500">
        Belum ada item plan. Master plan muncul di sini setelah dibuat dari
        report.
      </p>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {PLAN_ITEM_STATUSES.map((col) => {
        const colItems = local.filter((i) => i.status === col.value);
        return (
          <div
            key={col.value}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(col.value);
            }}
            onDragLeave={() => setOverCol((c) => (c === col.value ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (id) move(id, col.value);
              setOverCol(null);
              setDragId(null);
            }}
            className={cn(
              "flex w-[270px] shrink-0 flex-col rounded-2xl border p-3 transition-colors",
              overCol === col.value
                ? "border-coral/40 bg-coral/5"
                : "border-white/8 bg-surface/40",
            )}
          >
            <div className="mb-3 flex items-center justify-between px-1">
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
            <div className="flex min-h-[60px] flex-1 flex-col gap-2">
              {colItems.map((item) => (
                <Card
                  key={item.id}
                  item={item}
                  dragging={dragId === item.id}
                  onDragStart={() => setDragId(item.id)}
                  onDragEnd={() => setDragId(null)}
                  onMove={(s) => move(item.id, s)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
