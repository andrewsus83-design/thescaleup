"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { labelCls, textareaCls } from "@/components/brand/styles";
import type { FormState } from "@/lib/hub/actions";
import { addComment, decideTask, updateTask } from "@/lib/hub/task-actions";
import { summarizeTask } from "@/lib/hub/task-ai-actions";
import { LIMITS } from "@/lib/hub/tasks/rules";
import { PRIORITIES, PRIORITY_LABEL, type Member, type Priority, type WorkflowStatus } from "@/lib/hub/tasks/model";
import { cn } from "@/lib/utils";
import { compactField } from "./parts";

function Notice({ state }: { state: FormState }) {
  if (state.error)
    return (
      <Alert tone="bad" role="alert">
        {state.error}
      </Alert>
    );
  if (state.message)
    return (
      <Alert tone="ok" role="status">
        {state.message}
      </Alert>
    );
  return null;
}

export type TaskValues = {
  id: string;
  title: string;
  description: string;
  status: string;
  assigneeId: string;
  priority: Priority;
  startDate: string;
  dueDate: string;
  tags: string;
};

/**
 * The task's details. `fields` is false for people who may only change the status (ops): they get the status menu and
 * nothing else, so there is no form that would be refused on save. `statuses` is already limited to what they may pick.
 */
export function TaskForm({ brandId, values, statuses, members, fields }: { brandId: string; values: TaskValues; statuses: WorkflowStatus[]; members: Member[]; fields: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateTask, {});
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="taskId" value={values.id} />
      <Notice state={state} />
      {fields && (
        <>
          <div>
            <label htmlFor="td-title" className={labelCls}>
              Title
            </label>
            <input id="td-title" name="title" required maxLength={LIMITS.title} defaultValue={values.title} className={cn(compactField, "h-12 w-full text-body font-semibold")} />
          </div>
          <div>
            <label htmlFor="td-desc" className={labelCls}>
              Description
            </label>
            <textarea id="td-desc" name="description" rows={6} maxLength={LIMITS.description} defaultValue={values.description} className={textareaCls} placeholder="What done looks like, links, anything the person doing it needs." />
          </div>
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls}>Status</span>
          <select name="status" defaultValue={values.status} className={cn(compactField, "w-full")}>
            {statuses.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {fields && (
          <>
            <label className="block">
              <span className={labelCls}>Assignee</span>
              <select name="assigneeId" defaultValue={values.assigneeId} className={cn(compactField, "w-full")}>
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
              <select name="priority" defaultValue={values.priority} className={cn(compactField, "w-full")}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Tags</span>
              <input name="tags" maxLength={120} defaultValue={values.tags} placeholder="reel, instagram" className={cn(compactField, "w-full")} />
            </label>
            <label className="block">
              <span className={labelCls}>Start date</span>
              <input type="date" name="startDate" defaultValue={values.startDate} className={cn(compactField, "w-full")} />
            </label>
            <label className="block">
              <span className={labelCls}>Due date</span>
              <input type="date" name="dueDate" defaultValue={values.dueDate} className={cn(compactField, "w-full")} />
            </label>
          </>
        )}
      </div>
      <Btn type="submit" variant="primary" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-label="Saving" /> : "Save changes"}
      </Btn>
    </form>
  );
}

/** For a proposal: the founder approves it, or rejects it with a reason the proposer can read in the comments. */
export function DecisionPanel({ brandId, taskId }: { brandId: string; taskId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(decideTask, {});
  return (
    <Alert tone="warn" title="Waiting for your decision.">
      <form action={action} className="mt-3 space-y-4">
        <input type="hidden" name="brandId" value={brandId} />
        <input type="hidden" name="taskId" value={taskId} />
        <Notice state={state} />
        <div>
          <label htmlFor="dp-reason" className="mb-2 block text-small font-semibold text-ink-800">
            Reason <span className="font-normal text-ink-500">(shown to the team if you reject)</span>
          </label>
          <textarea id="dp-reason" name="reason" rows={2} maxLength={LIMITS.reason} className={cn(textareaCls, "bg-paper-0")} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Btn type="submit" name="decision" value="approve" variant="primary" disabled={pending}>
            Approve
          </Btn>
          <Btn type="submit" name="decision" value="reject" variant="danger" disabled={pending}>
            Reject
          </Btn>
        </div>
      </form>
    </Alert>
  );
}

export function CommentComposer({ brandId, taskId }: { brandId: string; taskId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addComment, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.message) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="taskId" value={taskId} />
      <Notice state={state} />
      <label htmlFor="cc-body" className={labelCls}>
        Add a comment
      </label>
      <textarea id="cc-body" name="body" required rows={3} maxLength={LIMITS.comment} className={textareaCls} />
      <Btn type="submit" variant="dark" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-label="Posting" /> : "Post comment"}
      </Btn>
    </form>
  );
}

export function SummarizeButton({ brandId, taskId }: { brandId: string; taskId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(summarizeTask, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="taskId" value={taskId} />
      <Notice state={state} />
      <Btn type="submit" variant="secondary" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-label="Summarizing" /> : <Sparkles className="size-4" aria-hidden />}
        Summarize and suggest next steps
      </Btn>
      <p className="text-caption text-ink-500">Claude reads this task and its comments, then posts a short summary below.</p>
    </form>
  );
}
