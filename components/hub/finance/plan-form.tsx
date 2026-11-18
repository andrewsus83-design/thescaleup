"use client";

import { useActionState, useId, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Alert, Btn, IconBtn } from "@/components/brand/primitives";
import { groupTitleCls, hintCls, inputCls } from "@/components/brand/styles";
import type { FormState } from "@/lib/hub/actions";
import { savePlan } from "@/lib/hub/finance-actions";
import { CATEGORIES, KIND_LABEL, LIMITS, MAX_PLAN_LINES, type EntryKind, type PlanLine } from "@/lib/hub/finance/model";
import { fmtMoney, moneyGrouped, parseMoney } from "@/lib/hub/money";

type Row = { id: number; kind: EntryKind; category: string; amount: string };

/** The rows the form opens with: the saved plan, or the usual categories waiting for an amount. */
function startRows(plan: PlanLine[], currency: string): Row[] {
  let id = 0;
  if (plan.length > 0) return plan.map((p) => ({ id: id++, kind: p.kind, category: p.category, amount: moneyGrouped(p.amount, currency) }));
  return (["out", "in"] as const).flatMap((kind) => CATEGORIES[kind].filter((c) => !/^other/i.test(c)).map((category) => ({ id: id++, kind, category, amount: "" })));
}

/**
 * The monthly plan as two lists, money out and money in. Each line is a category and the amount expected in a month. The totals
 * under the lists add up as you type; nothing is saved until Save plan.
 */
export function PlanForm({ brandId, plan, currency }: { brandId: string; plan: PlanLine[]; currency: string }) {
  const [rows, setRows] = useState<Row[]>(() => startRows(plan, currency));
  const [nextId, setNextId] = useState(1000);
  const [state, action, pending] = useActionState<FormState, FormData>(savePlan, {});
  const uid = useId();

  const set = (id: number, patch: Partial<Row>) => setRows((old) => old.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const add = (kind: EntryKind) => {
    setRows((old) => [...old, { id: nextId, kind, category: "", amount: "" }]);
    setNextId((n) => n + 1);
  };
  const sum = (kind: EntryKind) => rows.reduce((a, r) => a + (r.kind === kind ? (parseMoney(r.amount) ?? 0) : 0), 0);
  const totalIn = sum("in");
  const totalOut = sum("out");
  const net = totalIn - totalOut;
  const full = rows.length >= MAX_PLAN_LINES;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="lines" value={JSON.stringify(rows.map(({ kind, category, amount }) => ({ kind, category, amount })))} />
      <div aria-live="polite">
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
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {(["out", "in"] as const).map((kind) => {
          const mine = rows.filter((r) => r.kind === kind);
          return (
            <fieldset key={kind} className="min-w-0">
              <legend className={groupTitleCls}>{KIND_LABEL[kind]} each month</legend>
              <datalist id={`${uid}-${kind}`}>
                {CATEGORIES[kind].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <ul className="mt-4 space-y-3">
                {mine.map((r, i) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-field bg-paper-100 p-2 sm:flex-nowrap sm:bg-transparent sm:p-0">
                    <input
                      value={r.category}
                      onChange={(e) => set(r.id, { category: e.target.value })}
                      list={`${uid}-${kind}`}
                      maxLength={LIMITS.category}
                      aria-label={`${KIND_LABEL[kind]} line ${i + 1}: category`}
                      placeholder="Category"
                      autoComplete="off"
                      className={`${inputCls} min-w-0 basis-full sm:basis-0 sm:flex-1`}
                    />
                    <input
                      value={r.amount}
                      onChange={(e) => set(r.id, { amount: e.target.value })}
                      inputMode="decimal"
                      aria-label={`${KIND_LABEL[kind]} line ${i + 1}: amount in ${currency}`}
                      aria-invalid={r.amount.trim() !== "" && parseMoney(r.amount) === null}
                      placeholder="Amount"
                      autoComplete="off"
                      className={`${inputCls} min-w-0 flex-1 text-right font-mono sm:w-44 sm:flex-none`}
                    />
                    <IconBtn label={`Remove ${r.category || `line ${i + 1}`}`} onClick={() => setRows((old) => old.filter((x) => x.id !== r.id))}>
                      <X className="size-5" aria-hidden />
                    </IconBtn>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <Btn variant="secondary" size="sm" onClick={() => add(kind)} disabled={full}>
                  <Plus className="size-4" aria-hidden />
                  Add a line
                </Btn>
                <p className="font-mono text-small text-ink-600">
                  Total <span className="font-medium text-ink-800">{fmtMoney(kind === "in" ? totalIn : totalOut, currency)}</span>
                </p>
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-field bg-paper-100 px-5 py-4">
        <p className="text-small text-ink-600">
          This plan leaves{" "}
          <span className={`font-mono font-medium ${net < 0 ? "text-danger-ink" : "text-ink-800"}`}>
            {net < 0 ? "−" : ""}
            {fmtMoney(Math.abs(net), currency)}
          </span>{" "}
          a month{net < 0 ? ": it plans to spend more than comes in." : "."}
        </p>
        <Btn type="submit" variant="primary" size="md" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Save plan
        </Btn>
      </div>
      <p className={hintCls}>Type amounts like 15.000.000 or 15,000,000. A line without an amount is not saved. The same plan is used for every month.</p>
    </form>
  );
}
