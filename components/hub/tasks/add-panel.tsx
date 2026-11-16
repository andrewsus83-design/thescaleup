"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { labelCls, textareaCls } from "@/components/brand/styles";
import type { FormState } from "@/lib/hub/actions";
import { draftTasks } from "@/lib/hub/task-ai-actions";
import { createTask } from "@/lib/hub/task-actions";
import { MAX_INPUT_CHARS } from "@/lib/hub/tasks/ai-parse";
import { PRIORITIES, PRIORITY_LABEL, type Member } from "@/lib/hub/tasks/model";
import { cn } from "@/lib/utils";
import { compactField } from "./parts";

type Mode = "new" | "ai" | null;

function NewTaskForm({ brandId, members }: { brandId: string; members: Member[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createTask, {});
  const ref = useRef<HTMLFormElement>(null);
  // Clear the form once a task was added; keep what was typed when it failed.
  useEffect(() => {
    if (state.message) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-4">
      <input type="hidden" name="brandId" value={brandId} />
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
      <div>
        <label htmlFor="nt-title" className={labelCls}>
          What needs doing?
        </label>
        <input id="nt-title" name="title" required maxLength={200} autoFocus placeholder="Post the Friday reel" className={cn(compactField, "h-12 w-full")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className={labelCls}>Assignee</span>
          <select name="assigneeId" defaultValue="" className={cn(compactField, "w-full")}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.email.split("@")[0]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Due date</span>
          <input type="date" name="dueDate" className={cn(compactField, "w-full")} />
        </label>
        <label className="block">
          <span className={labelCls}>Priority</span>
          <select name="priority" defaultValue="normal" className={cn(compactField, "w-full")}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Tags</span>
          <input name="tags" maxLength={120} placeholder="reel, instagram" className={cn(compactField, "w-full")} />
        </label>
      </div>
      <Btn type="submit" variant="primary" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-label="Adding" /> : "Add task"}
      </Btn>
    </form>
  );
}

function DraftForm({ brandId }: { brandId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(draftTasks, {});
  const [len, setLen] = useState(0);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="brandId" value={brandId} />
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
      <div>
        <label htmlFor="ai-text" className={labelCls}>
          Paste meeting notes, a chat or an email
        </label>
        <textarea id="ai-text" name="text" required rows={7} maxLength={MAX_INPUT_CHARS} onChange={(e) => setLen(e.target.value.length)} className={textareaCls} placeholder="Dewi will send the invoice to the client by Friday. Budi to book the photographer for the launch…" />
        <p className="mt-2 text-caption text-ink-500">
          Claude reads this text and drafts tasks. They land as proposals for the founder to approve, nothing is added to the board until then. Do not paste passwords or customers&apos; personal details.
          <span className="ml-2 font-mono">
            {len.toLocaleString("en-US")}/{MAX_INPUT_CHARS.toLocaleString("en-US")}
          </span>
        </p>
      </div>
      <Btn type="submit" variant="dark" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-label="Drafting" /> : "Draft tasks"}
      </Btn>
    </form>
  );
}

/** Two ways to add work, closed until you ask: one task by hand, or several drafted by AI from pasted notes. */
export function AddPanel({ brandId, members, withAi }: { brandId: string; members: Member[]; withAi: boolean }) {
  const [mode, setMode] = useState<Mode>(null);
  const toggle = (m: Exclude<Mode, null>) => setMode((cur) => (cur === m ? null : m));
  return (
    <div className="mb-8">
      <div className="flex flex-wrap gap-3">
        <Btn variant={mode === "new" ? "dark" : "primary"} aria-expanded={mode === "new"} aria-controls="add-panel" onClick={() => toggle("new")}>
          <Plus className="size-4" aria-hidden />
          New task
        </Btn>
        {withAi && (
          <Btn variant="secondary" aria-expanded={mode === "ai"} aria-controls="add-panel" onClick={() => toggle("ai")}>
            <Sparkles className="size-4" aria-hidden />
            Draft from notes
          </Btn>
        )}
      </div>
      {mode && (
        <div id="add-panel" className="mt-4 rounded-card border border-hairline bg-paper-0 p-5 shadow-raised sm:p-6">
          {mode === "new" ? <NewTaskForm brandId={brandId} members={members} /> : <DraftForm brandId={brandId} />}
        </div>
      )}
    </div>
  );
}
