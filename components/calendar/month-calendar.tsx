"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalEvent = {
  date: string; // YYYY-MM-DD (or ISO — only first 10 chars used)
  title: string;
  group: string;
  tone?: "coral" | "sky" | "good" | "warn" | "slate";
  meta?: string;
};

const DOT: Record<string, string> = {
  coral: "bg-coral",
  sky: "bg-sky-400",
  good: "bg-good",
  warn: "bg-warn",
  slate: "bg-slate-500",
};
const CHIP: Record<string, string> = {
  coral: "border-coral/30 bg-coral/10 text-coral",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  good: "border-good/30 bg-good/10 text-good",
  warn: "border-warn/30 bg-warn/10 text-warn",
  slate: "border-white/15 bg-white/5 text-slate-300",
};
const WEEK = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function keyOf(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function MonthCalendar({
  events,
  groupOrder,
  emptyLabel,
}: {
  events: CalEvent[];
  groupOrder?: string[];
  emptyLabel?: string;
}) {
  const byDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      const k = e.date.slice(0, 10);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return map;
  }, [events]);

  const today = new Date();
  const todayKey = keyOf(today.getFullYear(), today.getMonth(), today.getDate());
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState<string>(todayKey);

  const startDow = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = () =>
    setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  const next = () =>
    setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));

  const selEvents = byDate.get(selected) ?? [];
  const groups =
    groupOrder && groupOrder.length
      ? groupOrder
      : Array.from(new Set(selEvents.map((e) => e.group)));
  const selDate = new Date(`${selected}T00:00:00`);

  const navBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/5";

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="rounded-2xl border border-white/8 bg-card/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={prev} className={navBtn} aria-label="Bulan sebelumnya">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="font-display font-bold text-mist">
            {MONTHS[view.m]} {view.y}
          </p>
          <button onClick={next} className={navBtn} aria-label="Bulan berikutnya">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEK.map((w) => (
            <div key={w} className="py-1 font-mono text-[0.6rem] uppercase text-slate-500">
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const k = keyOf(view.y, view.m, d);
            const evs = byDate.get(k) ?? [];
            const isSel = k === selected;
            const isToday = k === todayKey;
            return (
              <button
                key={i}
                onClick={() => setSelected(k)}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center gap-1 rounded-lg text-sm transition-colors",
                  isSel
                    ? "bg-coral font-semibold text-white"
                    : "text-slate-300 hover:bg-white/5",
                  isToday && !isSel && "ring-1 ring-coral/40",
                )}
              >
                <span>{d}</span>
                {evs.length > 0 && (
                  <span className="flex gap-0.5">
                    {evs.slice(0, 3).map((e, j) => (
                      <span
                        key={j}
                        className={cn(
                          "h-1 w-1 rounded-full",
                          isSel ? "bg-white" : DOT[e.tone ?? "slate"],
                        )}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-card/40 p-4">
        <p className="font-mono text-xs uppercase tracking-wider text-coral">
          {selDate.toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        {selEvents.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            {emptyLabel ?? "Tidak ada agenda di tanggal ini."}
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {groups.map((g) => {
              const list = selEvents.filter((e) => e.group === g);
              if (!list.length) return null;
              return (
                <div key={g}>
                  <p className="mb-2 text-xs font-semibold text-slate-400">{g}</p>
                  <div className="space-y-1.5">
                    {list.map((e, i) => (
                      <div
                        key={i}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm",
                          CHIP[e.tone ?? "slate"],
                        )}
                      >
                        {e.title}
                        {e.meta && (
                          <span className="ml-2 text-[0.62rem] uppercase opacity-70">
                            {e.meta}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
