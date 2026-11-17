"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pause, Pencil, Play, Plus, Repeat, Trash2 } from "lucide-react";
import { Alert, Btn, Card, Chip, EmptyState } from "@/components/brand/primitives";
import { labelCls, pillCls, textareaCls } from "@/components/brand/styles";
import { deleteRepeat, saveRepeat, setRepeatActive } from "@/lib/hub/repeat-actions";
import { weekdayMon0 } from "@/lib/hub/tasks/dates";
import { PRIORITIES, PRIORITY_LABEL, type Member } from "@/lib/hub/tasks/model";
import { describe, nextAfter, REPEAT_LIMITS, WEEKDAY_NAMES, WEEKDAY_SHORT, WORKDAYS, type Freq } from "@/lib/hub/tasks/recurrence-model";
import { cn } from "@/lib/utils";
import { compactField } from "./parts";

/** One repeating task as the page hands it over: the saved values plus the words that need the server's clock. */
export type RepeatRow = {
  id: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  priority: string;
  tags: string[];
  items: string[];
  freq: Freq;
  every: number;
  weekdays: number[];
  monthDay: number | null;
  dueInDays: number;
  startsOn: string;
  endsOn: string | null;
  active: boolean;
  summary: string;
  next: string;
  who: string;
};

type Form = { title: string; description: string; assigneeId: string; priority: string; tags: string; items: string; freq: Freq; every: string; weekdays: number[]; monthDay: string; dueInDays: string; startsOn: string; endsOn: string };

const blank = (today: string): Form => ({
  title: "",
  description: "",
  assigneeId: "",
  priority: "normal",
  tags: "",
  items: "",
  freq: "weekly",
  every: "1",
  weekdays: [weekdayMon0(today) + 1],
  monthDay: String(+today.slice(8, 10)),
  dueInDays: "0",
  startsOn: today,
  endsOn: "",
});

const fromRow = (r: RepeatRow, today: string): Form => ({
  ...blank(today),
  title: r.title,
  description: r.description ?? "",
  assigneeId: r.assigneeId ?? "",
  priority: r.priority,
  tags: r.tags.join(", "),
  items: r.items.join("\n"),
  freq: r.freq,
  every: String(r.every),
  weekdays: r.weekdays.length ? r.weekdays : blank(today).weekdays,
  monthDay: String(r.monthDay ?? +today.slice(8, 10)),
  dueInDays: String(r.dueInDays),
  startsOn: r.startsOn,
  endsOn: r.endsOn ?? "",
});

const UNIT: Record<Freq, string> = { daily: "day", weekly: "week", monthly: "month" };

/** What the person has typed so far, in words, so they see "Every Mon and Thu. Next: Mon 23 Nov" before saving. */
function preview(f: Form, today: string): string {
  const every = Number(f.every);
  const monthDay = Number(f.monthDay);
  if (!Number.isInteger(every) || every < 1 || every > REPEAT_LIMITS.every) return "";
  if (f.freq === "weekly" && f.weekdays.length === 0) return "";
  if (f.freq === "monthly" && !(Number.isInteger(monthDay) && monthDay >= 1 && monthDay <= 31)) return "";
  const s = { freq: f.freq, every, weekdays: f.freq === "weekly" ? f.weekdays : [], month_day: f.freq === "monthly" ? monthDay : null, starts_on: f.startsOn || today, ends_on: f.endsOn || null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.starts_on)) return "";
  const next = nextAfter(s, today);
  return `${describe(s)}${next ? `. Next: ${next === today ? "today" : next}` : ". It has no day left."}`;
}

function RepeatForm({ brandId, members, today, id, initial, onSaved, onCancel }: { brandId: string; members: Member[]; today: string; id?: string; initial: Form; onSaved: (made: number) => void; onCancel: () => void }) {
  const [f, setF] = useState<Form>(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggleDay = (d: number) => set("weekdays", f.weekdays.includes(d) ? f.weekdays.filter((x) => x !== d) : [...f.weekdays, d].sort((a, b) => a - b));
  const words = preview(f, today);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const r = await saveRepeat({
        brandId,
        id,
        title: f.title,
        description: f.description,
        assigneeId: f.assigneeId,
        priority: f.priority,
        tags: f.tags,
        items: f.items,
        freq: f.freq,
        every: f.every,
        weekdays: f.weekdays,
        monthDay: f.monthDay,
        dueInDays: f.dueInDays,
        startsOn: f.startsOn,
        endsOn: f.endsOn,
      });
      if (r.ok) onSaved(r.made);
      else setError(r.error);
    });
  };

  const key = id ?? "new";
  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <Alert tone="bad" role="alert">
          {error}
        </Alert>
      )}
      <div>
        <label htmlFor={`rt-title-${key}`} className={labelCls}>
          What needs doing?
        </label>
        <input id={`rt-title-${key}`} value={f.title} onChange={(e) => set("title", e.target.value)} required maxLength={200} placeholder="Send the weekly report to the client" className={cn(compactField, "h-12 w-full")} />
      </div>

      <fieldset className="space-y-3">
        <legend className={labelCls}>How often?</legend>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-small text-ink-800">Every</span>
          <label>
            <span className="sr-only">Repeat every</span>
            <input type="number" min={1} max={REPEAT_LIMITS.every} value={f.every} onChange={(e) => set("every", e.target.value)} className={cn(compactField, "w-20")} />
          </label>
          <label>
            <span className="sr-only">Unit</span>
            <select value={f.freq} onChange={(e) => set("freq", e.target.value as Freq)} className={compactField}>
              {(["daily", "weekly", "monthly"] as const).map((k) => (
                <option key={k} value={k}>
                  {UNIT[k]}
                  {Number(f.every) === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>
        </div>
        {f.freq === "weekly" && (
          <div>
            <div role="group" aria-label="Days of the week" className="flex flex-wrap gap-2">
              {WEEKDAY_SHORT.map((name, i) => (
                <button key={name} type="button" aria-pressed={f.weekdays.includes(i + 1)} aria-label={WEEKDAY_NAMES[i]} onClick={() => toggleDay(i + 1)} className={cn(pillCls(f.weekdays.includes(i + 1)), "px-4")}>
                  {name}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => set("weekdays", [...WORKDAYS])} className="mt-2 inline-flex min-h-11 items-center text-small font-semibold text-brand-700 underline underline-offset-4">
              Monday to Friday
            </button>
          </div>
        )}
        {f.freq === "monthly" && (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`rt-md-${key}`} className="text-small text-ink-800">
              On day
            </label>
            <input id={`rt-md-${key}`} type="number" min={1} max={31} value={f.monthDay} onChange={(e) => set("monthDay", e.target.value)} className={cn(compactField, "w-20")} />
            <span className="text-caption text-ink-500">A month that is shorter uses its last day.</span>
          </div>
        )}
        {words && (
          <p className="text-small font-semibold text-ink-800" aria-live="polite">
            {words}
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className={labelCls}>Assignee</span>
          <select value={f.assigneeId} onChange={(e) => set("assigneeId", e.target.value)} className={cn(compactField, "w-full")}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.email.split("@")[0]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Priority</span>
          <select value={f.priority} onChange={(e) => set("priority", e.target.value)} className={cn(compactField, "w-full")}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Due after (days)</span>
          <input type="number" min={0} max={REPEAT_LIMITS.dueIn} value={f.dueInDays} onChange={(e) => set("dueInDays", e.target.value)} className={cn(compactField, "w-full")} />
        </label>
        <label className="block">
          <span className={labelCls}>Tags</span>
          <input value={f.tags} onChange={(e) => set("tags", e.target.value)} maxLength={120} placeholder="report, client" className={cn(compactField, "w-full")} />
        </label>
        <label className="block">
          <span className={labelCls}>First day</span>
          <input type="date" value={f.startsOn} onChange={(e) => set("startsOn", e.target.value)} className={cn(compactField, "w-full")} />
        </label>
        <label className="block">
          <span className={labelCls}>Last day (optional)</span>
          <input type="date" value={f.endsOn} onChange={(e) => set("endsOn", e.target.value)} className={cn(compactField, "w-full")} />
        </label>
      </div>

      <div>
        <label htmlFor={`rt-desc-${key}`} className={labelCls}>
          Details (optional)
        </label>
        <textarea id={`rt-desc-${key}`} value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} maxLength={8000} className={textareaCls} />
      </div>
      <div>
        <label htmlFor={`rt-items-${key}`} className={labelCls}>
          Checklist (optional, one item per line)
        </label>
        <textarea id={`rt-items-${key}`} value={f.items} onChange={(e) => set("items", e.target.value)} rows={4} placeholder={"Pull the numbers\nWrite the summary\nSend to the client"} className={textareaCls} />
        <p className="mt-2 text-caption text-ink-500">Every task it makes starts with this checklist, up to {REPEAT_LIMITS.items} items.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Btn type="submit" variant="primary" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-label="Saving" /> : id ? "Save changes" : "Start repeating"}
        </Btn>
        <Btn variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Btn>
      </div>
    </form>
  );
}

export function RepeatManager({ brandId, members, rows, canManage, today }: { brandId: string; members: Member[]; rows: RepeatRow[]; canManage: boolean; today: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null); // a row id, "new" or null
  const [confirming, setConfirming] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const saved = (made: number) => {
    setEditing(null);
    setMsg({ tone: "ok", text: made > 0 ? "Saved. Today's task is on the board." : "Saved." });
    router.refresh();
  };
  const toggle = (r: RepeatRow) =>
    start(async () => {
      setMsg(null);
      const res = await setRepeatActive(brandId, r.id, !r.active);
      if (res.ok) {
        setMsg({ tone: "ok", text: r.active ? "Paused. It makes no tasks until you resume it." : res.made > 0 ? "Resumed. Today's task is on the board." : "Resumed. It does not make up for the days it was paused." });
        router.refresh();
      } else setMsg({ tone: "bad", text: res.error });
    });
  const remove = (r: RepeatRow) =>
    start(async () => {
      setMsg(null);
      const res = await deleteRepeat(brandId, r.id);
      setConfirming(null);
      if (res.ok) {
        setMsg({ tone: "ok", text: "Deleted. Tasks it already made are still on the board." });
        router.refresh();
      } else setMsg({ tone: "bad", text: res.error });
    });

  return (
    <div className="space-y-6">
      {msg && (
        <Alert tone={msg.tone} role={msg.tone === "bad" ? "alert" : "status"}>
          {msg.text}
        </Alert>
      )}

      {canManage &&
        (editing === "new" ? (
          <Card>
            <h2 className="mb-5 font-title text-h3 text-ink-800">New repeating task</h2>
            <RepeatForm brandId={brandId} members={members} today={today} initial={blank(today)} onSaved={saved} onCancel={() => setEditing(null)} />
          </Card>
        ) : (
          <div>
            <Btn variant="primary" onClick={() => setEditing("new")}>
              <Plus className="size-5" aria-hidden />
              New repeating task
            </Btn>
          </div>
        ))}

      {rows.length === 0 ? (
        editing !== "new" && (
          <EmptyState icon={<Repeat className="size-6" aria-hidden />} title="Nothing repeats yet" hint="Set up the work that comes round again, like a weekly report or a monthly invoice. A task appears on the board on each day, and nobody has to remember to add it." />
        )
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card small>
                {editing === r.id ? (
                  <RepeatForm brandId={brandId} members={members} today={today} id={r.id} initial={fromRow(r, today)} onSaved={saved} onCancel={() => setEditing(null)} />
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink-800">{r.title}</p>
                      <p className="mt-1 text-small text-ink-800">{r.summary}</p>
                      <p className="mt-1 text-caption text-ink-500">
                        Next: {r.next} · {r.who}
                        {r.items.length > 0 && ` · ${r.items.length} checklist ${r.items.length === 1 ? "item" : "items"}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!r.active && <Chip tone="warn">Paused</Chip>}
                      {canManage &&
                        (confirming === r.id ? (
                          <>
                            <span className="text-caption text-ink-500">Delete it? Tasks it made stay.</span>
                            <Btn size="sm" variant="danger" onClick={() => remove(r)} disabled={pending}>
                              Delete
                            </Btn>
                            <Btn size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                              Keep
                            </Btn>
                          </>
                        ) : (
                          <>
                            <Btn size="sm" onClick={() => setEditing(r.id)} disabled={pending}>
                              <Pencil className="size-4" aria-hidden />
                              Edit
                            </Btn>
                            <Btn size="sm" onClick={() => toggle(r)} disabled={pending}>
                              {r.active ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                              {r.active ? "Pause" : "Resume"}
                            </Btn>
                            <Btn size="sm" variant="ghost" onClick={() => setConfirming(r.id)} disabled={pending} aria-label={`Delete ${r.title}`}>
                              <Trash2 className="size-4" aria-hidden />
                            </Btn>
                          </>
                        ))}
                    </div>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
