"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { Alert, Btn, IconBtn } from "@/components/brand/primitives";
import { labelCls } from "@/components/brand/styles";
import { compactField } from "@/components/hub/tasks/parts";
import { saveStages } from "@/lib/hub/crm-actions";
import { DEFAULT_STAGES, STAGE_LIMITS, stagesOf, type Kind, type StageDef } from "@/lib/hub/crm/model";
import type { FormState } from "@/lib/hub/actions";

type Row = StageDef & { id: number };

const COPY: Record<Kind, { title: string; hint: string; open: string; add: string }> = {
  lead: {
    title: "Lead stages",
    hint: "The steps from first contact to a decision. Put them in the order people move through them.",
    open: "Still being worked",
    add: "Add a lead stage",
  },
  client: {
    title: "Client stages",
    hint: "Where a client stands once they have bought.",
    open: "Still a client",
    add: "Add a client stage",
  },
};

/** Edit the brand's stages: rename, reorder, add, remove. A stage that is not "still active" (Lost, Left) is left out of follow-ups. */
export function StageEditor({ brandId, stages }: { brandId: string; stages: StageDef[] }) {
  // Ids only tell the rows apart while editing; a new row takes the next free one.
  const withIds = (list: readonly StageDef[]): Row[] => list.map((s, i) => ({ ...s, id: i }));
  const [rows, setRows] = useState<Row[]>(() => withIds(stages));
  const [state, action, pending] = useActionState<FormState, FormData>(saveStages, {});

  const patch = (id: number, p: Partial<StageDef>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const remove = (id: number) => setRows((r) => r.filter((x) => x.id !== id));
  const move = (id: number, dir: -1 | 1) =>
    setRows((r) => {
      const i = r.findIndex((x) => x.id === id);
      let j = i + dir;
      while (j >= 0 && j < r.length && r[j].kind !== r[i].kind) j += dir;
      if (i < 0 || j < 0 || j >= r.length) return r;
      const out = [...r];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });
  const add = (kind: Kind) => setRows((r) => [...r, { id: r.reduce((m, x) => Math.max(m, x.id), -1) + 1, key: "", label: "", kind, open: true }]);
  const reset = () => setRows(withIds(DEFAULT_STAGES));
  const payload = JSON.stringify(rows.map(({ key, label, kind, open }) => ({ key, label, kind, open })));

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="stages" value={payload} />
      {state.error && (
        <Alert tone="bad" role="alert">
          {state.error}
        </Alert>
      )}
      {state.message && (
        <Alert tone="ok" role="status">
          {state.message}
        </Alert>
      )}

      {(["lead", "client"] as const).map((kind) => {
        const group = stagesOf(rows, kind) as Row[];
        const c = COPY[kind];
        return (
          <fieldset key={kind} className="space-y-3">
            <legend className="font-title text-h3 text-ink-800">{c.title}</legend>
            <p className="text-small text-ink-500">{c.hint}</p>
            <ul className="space-y-3">
              {group.map((s, i) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-bubble bg-paper-100 p-3 sm:flex-nowrap">
                  <label className="sr-only" htmlFor={`stage-${s.id}`}>
                    Stage name
                  </label>
                  <input id={`stage-${s.id}`} value={s.label} onChange={(e) => patch(s.id, { label: e.target.value })} maxLength={STAGE_LIMITS.label} placeholder="Stage name" autoComplete="off" className={`${compactField} min-w-0 flex-1 basis-full sm:basis-0`} />
                  <label className="hit-44 inline-flex min-h-11 items-center gap-2 text-small text-ink-800">
                    <input type="checkbox" checked={s.open} onChange={(e) => patch(s.id, { open: e.target.checked })} className="size-5 accent-(--acc-fill)" />
                    {c.open}
                  </label>
                  <span className="ml-auto flex items-center">
                    <IconBtn label={`Move ${s.label || "stage"} up`} onClick={() => move(s.id, -1)} disabled={i === 0}>
                      <ArrowUp className="size-4" aria-hidden />
                    </IconBtn>
                    <IconBtn label={`Move ${s.label || "stage"} down`} onClick={() => move(s.id, 1)} disabled={i === group.length - 1}>
                      <ArrowDown className="size-4" aria-hidden />
                    </IconBtn>
                    <IconBtn label={`Remove ${s.label || "stage"}`} onClick={() => remove(s.id)} disabled={group.length <= 1}>
                      <Trash2 className="size-4" aria-hidden />
                    </IconBtn>
                  </span>
                </li>
              ))}
            </ul>
            <Btn type="button" variant="secondary" size="md" onClick={() => add(kind)} disabled={group.length >= STAGE_LIMITS.perKind}>
              <Plus className="size-4" aria-hidden />
              {c.add}
            </Btn>
          </fieldset>
        );
      })}

      <div className="flex flex-wrap items-center gap-3">
        <Btn type="submit" variant="primary" size="lg" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Save stages
        </Btn>
        <Btn type="button" variant="ghost" size="md" onClick={reset}>
          Use the standard stages
        </Btn>
      </div>
      <p className={`${labelCls} !mb-0 font-normal text-ink-500`}>A stage with people in it cannot be removed: move them first. Renaming is always safe.</p>
    </form>
  );
}
