"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { labelCls } from "@/components/brand/styles";
import { compactField } from "@/components/hub/tasks/parts";
import { saveWorkflow } from "@/lib/hub/workflow-actions";
import { STAGE_HINT, STAGE_LABEL, WORKFLOW_LIMITS, stageOptions, type Draft } from "@/lib/hub/tasks/workflow";
import type { Stage } from "@/lib/hub/tasks/model";
import { cn } from "@/lib/utils";

type Row = Draft & { id: number; used: number };

export function WorkflowEditor({ brandId, initial, approvalRequired: approval0 }: { brandId: string; initial: { key: string; label: string; stage: string; used: number }[]; approvalRequired: boolean }) {
  const [seq, setSeq] = useState(initial.length);
  const [rows, setRows] = useState<Row[]>(initial.map((s, i) => ({ id: i, key: s.key, label: s.label, stage: s.stage, used: s.used })));
  const [approval, setApproval] = useState(approval0);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const edit = (id: number, patch: Partial<Row>) => {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setMsg(null);
  };
  const move = (i: number, by: -1 | 1) => {
    setRows((r) => {
      const j = i + by;
      if (j < 0 || j >= r.length) return r;
      const next = [...r];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setMsg(null);
  };
  const add = () => {
    setRows((r) => [...r, { id: seq, key: null, label: "", stage: "active", used: 0 }]);
    setSeq((n) => n + 1);
    setMsg(null);
  };
  const remove = (id: number) => {
    setRows((r) => r.filter((x) => x.id !== id));
    setMsg(null);
  };
  const save = () =>
    start(async () => {
      const r = await saveWorkflow({ brandId, approvalRequired: approval, statuses: rows.map(({ key, label, stage }) => ({ key, label, stage })) });
      setMsg(r.ok ? { tone: "ok", text: r.message } : { tone: "bad", text: r.error });
    });

  return (
    <div className="space-y-6">
      {msg && (
        <Alert tone={msg.tone} role={msg.tone === "bad" ? "alert" : "status"}>
          {msg.text}
        </Alert>
      )}
      <ol className="space-y-3">
        {rows.map((r, i) => {
          const locked = r.key !== null;
          return (
            <li key={r.id} className="rounded-bubble border border-hairline bg-paper-0 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
                <label className="block">
                  <span className={labelCls}>Name</span>
                  <input value={r.label} maxLength={WORKFLOW_LIMITS.label} onChange={(e) => edit(r.id, { label: e.target.value })} placeholder="Waiting for client" className={cn(compactField, "w-full")} />
                </label>
                <label className="block">
                  <span className={labelCls}>Means</span>
                  <select value={r.stage} disabled={locked} onChange={(e) => edit(r.id, { stage: e.target.value })} className={cn(compactField, "w-full disabled:bg-paper-100 disabled:text-ink-500")}>
                    {stageOptions.map((o) => (
                      <option key={o.stage} value={o.stage}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-2 text-caption text-ink-500">
                {STAGE_HINT[r.stage as Stage] ?? ""}
                {locked ? ` What it means is fixed, because tasks are filed under it.` : ""}
                {r.used > 0 ? ` ${r.used} ${r.used === 1 ? "task is" : "tasks are"} here.` : ""}
              </p>
              <div className="mt-2 flex items-center gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${r.label || "this status"} up`} className="hit-44 inline-flex size-11 items-center justify-center rounded-full text-ink-500 hover:bg-paper-100 disabled:opacity-30">
                  <ArrowUp className="size-4" aria-hidden />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move ${r.label || "this status"} down`} className="hit-44 inline-flex size-11 items-center justify-center rounded-full text-ink-500 hover:bg-paper-100 disabled:opacity-30">
                  <ArrowDown className="size-4" aria-hidden />
                </button>
                <button type="button" onClick={() => remove(r.id)} disabled={r.used > 0} aria-label={r.used > 0 ? `${r.label} cannot be removed while tasks are in it` : `Remove ${r.label || "this status"}`} className="hit-44 inline-flex size-11 items-center justify-center rounded-full text-ink-500 hover:bg-paper-100 disabled:opacity-30">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <Btn variant="secondary" onClick={add} disabled={rows.length >= WORKFLOW_LIMITS.statuses}>
        <Plus className="size-4" aria-hidden />
        Add a status
      </Btn>

      <label className="flex items-start gap-3 text-small text-ink-800">
        <input type="checkbox" checked={approval} onChange={(e) => {
            setApproval(e.target.checked);
            setMsg(null);
          }} className="mt-0.5 size-5 shrink-0 accent-ink-800" />
        <span>
          New tasks from the team and AI drafts wait for approval first.
          <span className="mt-1 block text-caption text-ink-500">Needs a status that means “{STAGE_LABEL.proposed}”. The founder&apos;s own tasks are approved already.</span>
        </span>
      </label>

      <Btn variant="primary" disabled={pending} onClick={save}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-label="Saving" /> : null}
        Save workflow
      </Btn>
    </div>
  );
}
