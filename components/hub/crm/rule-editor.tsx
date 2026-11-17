"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Btn, Chip } from "@/components/brand/primitives";
import { compactField } from "@/components/hub/tasks/parts";
import { saveRules } from "@/lib/hub/crm-actions";
import { MOVER, RULE_LIMITS, stagesOf, type Kind, type StageDef, type StageRule } from "@/lib/hub/crm/model";
import type { FormState } from "@/lib/hub/actions";

type Draft = { follow: boolean; days: string; task: boolean; title: string; due: string; assignee: string };
const NOBODY = "";

const COPY: Record<Kind, { title: string; hint: string }> = {
  lead: { title: "When a lead enters a stage", hint: "Runs when someone is added to the stage or moved into it." },
  client: { title: "When a client enters a stage", hint: "Also runs for a lead who just became a client (the first client stage)." },
};

function toDraft(rule: StageRule | undefined): Draft {
  return {
    follow: !!rule?.followUpDays,
    days: String(rule?.followUpDays ?? 3),
    task: !!rule?.task,
    title: rule?.task?.title ?? "",
    due: rule?.task ? (rule.task.dueDays === null ? "" : String(rule.task.dueDays)) : "2",
    assignee: rule?.task?.assignee ?? NOBODY,
  };
}

/** A whole number from a text box, or -1 so the server says what is wrong instead of this form quietly dropping it. */
const whole = (v: string) => (/^\d{1,3}$/.test(v.trim()) ? Number(v) : -1);

/** One block per stage: set a follow-up and/or add a task whenever someone enters it. */
export function RuleEditor({ brandId, stages, rules, members }: { brandId: string; stages: StageDef[]; rules: StageRule[]; members: { id: string; name: string }[] }) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(stages.map((s) => [s.key, toDraft(rules.find((r) => r.stage === s.key))])));
  const [state, action, pending] = useActionState<FormState, FormData>(saveRules, {});
  const patch = (key: string, p: Partial<Draft>) => setDrafts((d) => ({ ...d, [key]: { ...d[key], ...p } }));

  const payload = JSON.stringify(
    stages.flatMap((s) => {
      const d = drafts[s.key];
      if (!d) return [];
      const follow = d.follow && s.open;
      if (!follow && !d.task) return [];
      return [
        {
          stage: s.key,
          followUpDays: follow ? whole(d.days) : null,
          task: d.task ? { title: d.title, dueDays: d.due.trim() === "" ? null : whole(d.due), assignee: d.assignee === NOBODY ? null : d.assignee } : null,
        },
      ];
    }),
  );

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="rules" value={payload} />
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

      {(["lead", "client"] as const).map((kind) => (
        <section key={kind} className="space-y-3" aria-labelledby={`auto-${kind}`}>
          <h2 id={`auto-${kind}`} className="font-title text-h3 text-ink-800">
            {COPY[kind].title}
          </h2>
          <p className="text-small text-ink-500">{COPY[kind].hint}</p>
          <ul className="space-y-3">
            {stagesOf(stages, kind).map((s) => {
              const d = drafts[s.key] ?? toDraft(undefined);
              const on = (d.follow && s.open) || d.task;
              return (
                <li key={s.key}>
                  <fieldset className="space-y-4 rounded-bubble bg-paper-100 p-4">
                    <legend className="sr-only">{s.label}</legend>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-title text-body font-semibold text-ink-800">{s.label}</p>
                      {on ? <Chip tone="ok">On</Chip> : <span className="text-small text-ink-500">Does nothing</span>}
                    </div>

                    {s.open ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <label className="inline-flex min-h-11 items-center gap-2 text-small text-ink-800">
                          <input type="checkbox" checked={d.follow} onChange={(e) => patch(s.key, { follow: e.target.checked })} className="size-5 accent-(--acc-fill)" />
                          Set the next follow-up
                        </label>
                        {d.follow && (
                          <span className="inline-flex items-center gap-2 text-small text-ink-800">
                            <label htmlFor={`${s.key}-days`} className="sr-only">
                              Days until the follow-up
                            </label>
                            <input id={`${s.key}-days`} value={d.days} onChange={(e) => patch(s.key, { days: e.target.value })} inputMode="numeric" maxLength={2} className={`${compactField} w-20 text-center`} />
                            days from the day they arrive
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-small text-ink-500">This stage ends the story, so it has no follow-up.</p>
                    )}

                    <div className="space-y-3">
                      <label className="inline-flex min-h-11 items-center gap-2 text-small text-ink-800">
                        <input type="checkbox" checked={d.task} onChange={(e) => patch(s.key, { task: e.target.checked })} className="size-5 accent-(--acc-fill)" />
                        Add a task
                      </label>
                      {d.task && (
                        <div className="space-y-3 border-l-2 border-ink-200 pl-4">
                          <div>
                            <label htmlFor={`${s.key}-title`} className="mb-1 block text-small font-medium text-ink-800">
                              Task title
                            </label>
                            <input id={`${s.key}-title`} value={d.title} onChange={(e) => patch(s.key, { title: e.target.value })} maxLength={RULE_LIMITS.title} placeholder={"Send the proposal to {name}"} autoComplete="off" className={`${compactField} w-full`} />
                            <p className="mt-1 text-caption text-ink-500">
                              {"{name}"} and {"{company}"} are replaced with the person&apos;s own.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-4">
                            <div>
                              <label htmlFor={`${s.key}-due`} className="mb-1 block text-small font-medium text-ink-800">
                                Due in (days)
                              </label>
                              <input id={`${s.key}-due`} value={d.due} onChange={(e) => patch(s.key, { due: e.target.value })} inputMode="numeric" maxLength={2} placeholder="None" className={`${compactField} w-24 text-center`} />
                            </div>
                            <div className="min-w-0 flex-1 basis-48">
                              <label htmlFor={`${s.key}-who`} className="mb-1 block text-small font-medium text-ink-800">
                                Give it to
                              </label>
                              <select id={`${s.key}-who`} value={d.assignee} onChange={(e) => patch(s.key, { assignee: e.target.value })} className={`${compactField} w-full`}>
                                <option value={NOBODY}>Nobody yet</option>
                                <option value={MOVER}>Whoever moved them</option>
                                {members.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </fieldset>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <Btn type="submit" variant="primary" size="lg" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Save automations
      </Btn>
      <p className="text-small text-ink-500">
        Tasks are added to the brand&apos;s Tasks as already approved, even when the person moving someone cannot add tasks. If the same task is still open for the same person, a second one is not added. Change the stages themselves in Setup.
      </p>
    </form>
  );
}
