"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Loader2, Pencil, Trash2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { textareaCls } from "@/components/brand/styles";
import { addItems, moveItem, removeItem, renameItem, toggleItem } from "@/lib/hub/task-item-actions";
import { ITEM_LIMITS, progressOf, type Item } from "@/lib/hub/tasks/items";
import { cn } from "@/lib/utils";
import { compactField } from "./parts";

type Result = { ok: true; items: Item[] } | { ok: false; error: string };

const iconBtn = "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-paper-100 hover:text-ink-800 disabled:opacity-40";

/**
 * The task's checklist. Ticking is for anyone who may work the task; adding, renaming, reordering and deleting are for
 * the founder and staff (`canEdit`). Every change comes back from the server as the whole list, so what is shown is what is saved.
 */
export function Checklist({ brandId, taskId, initial, canEdit, canTick }: { brandId: string; taskId: string; initial: Item[]; canEdit: boolean; canTick: boolean }) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState("");
  const [busy, start] = useTransition();

  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (r.ok) {
        setItems(r.items);
        after?.();
      } else setError(r.error);
    });

  const { done, total } = progressOf(items);
  if (!canEdit && !canTick && total === 0) return <p className="text-small text-ink-500">No checklist yet.</p>;

  return (
    <div className="space-y-4">
      {error && (
        <Alert tone="bad" role="alert">
          {error}
        </Alert>
      )}
      {total > 0 && (
        <div>
          <p role="status" className="text-small font-semibold text-ink-800">
            {done} of {total} done
          </p>
          <div aria-hidden className="mt-2 h-2 overflow-hidden rounded-full bg-paper-100">
            <div className="h-full rounded-full bg-success transition-[width] duration-200" style={{ width: `${Math.round((done / total) * 100)}%` }} />
          </div>
        </div>
      )}
      {total > 0 && (
        <ul className="divide-y divide-hairline rounded-field border border-hairline bg-paper-0">
          {items.map((it, i) => (
            <li key={it.id} className="flex items-center gap-1 pr-1 pl-3">
              {editing === it.id ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-2 py-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => renameItem(brandId, taskId, it.id, draft), () => setEditing(null));
                  }}
                >
                  <input aria-label="Item text" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={ITEM_LIMITS.text} autoFocus className={cn(compactField, "h-11 min-w-0 flex-1")} />
                  <Btn type="submit" variant="primary" size="sm" disabled={busy}>
                    Save
                  </Btn>
                  <Btn variant="secondary" size="sm" onClick={() => setEditing(null)}>
                    Cancel
                  </Btn>
                </form>
              ) : (
                <>
                  <label className={cn("flex min-h-11 min-w-0 flex-1 items-center gap-3 py-1", canTick && "cursor-pointer")}>
                    <input type="checkbox" checked={it.done} disabled={!canTick || busy} onChange={(e) => run(() => toggleItem(brandId, taskId, it.id, e.target.checked))} className="size-5 shrink-0 accent-ink-800" />
                    <span className={cn("min-w-0 break-words text-body", it.done ? "text-ink-500 line-through decoration-ink-300" : "text-ink-800")}>{it.body}</span>
                  </label>
                  {canEdit && (
                    <span className="flex shrink-0 items-center">
                      <button type="button" aria-label={`Move up: ${it.body}`} disabled={busy || i === 0} onClick={() => run(() => moveItem(brandId, taskId, it.id, "up"))} className={iconBtn}>
                        <ArrowUp className="size-4" aria-hidden />
                      </button>
                      <button type="button" aria-label={`Move down: ${it.body}`} disabled={busy || i === items.length - 1} onClick={() => run(() => moveItem(brandId, taskId, it.id, "down"))} className={iconBtn}>
                        <ArrowDown className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`Edit: ${it.body}`}
                        disabled={busy}
                        onClick={() => {
                          setDraft(it.body);
                          setEditing(it.id);
                        }}
                        className={iconBtn}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      <button type="button" aria-label={`Delete: ${it.body}`} disabled={busy} onClick={() => run(() => removeItem(brandId, taskId, it.id))} className={iconBtn}>
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </span>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {total === 0 && canEdit && <p className="text-small text-ink-500">No steps yet. Break the work into small items and tick them off as you go.</p>}
      {canEdit && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!adding.trim()) return;
            run(() => addItems(brandId, taskId, adding), () => setAdding(""));
          }}
        >
          <label htmlFor="cl-add" className="block text-small font-semibold text-ink-800">
            Add items
          </label>
          <textarea id="cl-add" value={adding} onChange={(e) => setAdding(e.target.value)} rows={2} maxLength={ITEM_LIMITS.text * 20} className={textareaCls} placeholder="One item per line. A pasted “- [ ] step” list works too." />
          <Btn type="submit" variant="dark" disabled={busy || !adding.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-label="Saving" /> : "Add"}
          </Btn>
        </form>
      )}
    </div>
  );
}
