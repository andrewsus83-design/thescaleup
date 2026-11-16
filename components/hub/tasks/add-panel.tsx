"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { labelCls, textareaCls } from "@/components/brand/styles";
import type { FormState } from "@/lib/hub/actions";
import { draftTasks } from "@/lib/hub/task-ai-actions";
import { createTask } from "@/lib/hub/task-actions";
import { MAX_GOAL_CHARS, MAX_INPUT_CHARS, type DraftMode } from "@/lib/hub/tasks/ai-parse";
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

const MODES: { key: DraftMode; label: string; field: string; placeholder: string; max: number; rows: number }[] = [
  { key: "plan", label: "Plan from a goal", field: "What do you want to get done?", placeholder: "Launch the Ramadan campaign for the brand: 4 reels, 2 carousels and a paid push. It goes live on 1 March.", max: MAX_GOAL_CHARS, rows: 4 },
  { key: "notes", label: "Tasks from notes", field: "Paste meeting notes, a chat or an email", placeholder: "Dewi will send the invoice to the client by Friday. Budi to book the photographer for the launch…", max: MAX_INPUT_CHARS, rows: 7 },
];

function DraftForm({ brandId }: { brandId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(draftTasks, {});
  const [mode, setMode] = useState<DraftMode>("plan");
  const [len, setLen] = useState(0);
  const m = MODES.find((x) => x.key === mode) ?? MODES[0];
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
      <fieldset>
        <legend className="sr-only">What to give Claude</legend>
        <div className="inline-flex rounded-full border border-hairline bg-paper-100 p-1">
          {MODES.map((x) => (
            <label key={x.key} className="relative">
              <input type="radio" name="mode" value={x.key} checked={mode === x.key} onChange={() => {
                  setMode(x.key);
                  setLen(0);
                }} className="peer sr-only" />
              <span className="hit-44 inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-small font-semibold text-ink-500 peer-checked:bg-ink-800 peer-checked:text-paper-0 peer-focus-visible:ring-2 peer-focus-visible:ring-ink-800">{x.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="ai-text" className={labelCls}>
          {m.field}
        </label>
        <textarea key={mode} id="ai-text" name="text" required rows={m.rows} maxLength={m.max} onChange={(e) => setLen(e.target.value.length)} className={textareaCls} placeholder={m.placeholder} />
        <p className="mt-2 text-caption text-ink-500">
          Claude drafts the tasks. If this brand approves new work, they wait in the list for the founder; otherwise they go straight onto the board. You can edit or delete any of them. Do not paste passwords or customers&apos; personal details.
          <span className="ml-2 font-mono">
            {len.toLocaleString("en-US")}/{m.max.toLocaleString("en-US")}
          </span>
        </p>
      </div>
      <Btn type="submit" variant="dark" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-label="Generating" /> : "Generate tasks"}
      </Btn>
    </form>
  );
}

/** Shown instead of the form while no Anthropic key is saved, so the button never just disappears. */
function NoKey({ slug, canSetKey }: { slug: string; canSetKey: boolean }) {
  return (
    <Alert tone="info">
      AI is not set up for this brand yet.{" "}
      {canSetKey ? (
        <Link href={`/hub/b/${slug}/settings/integrations`} className="font-semibold underline underline-offset-2">
          Add an Anthropic key in Settings
        </Link>
      ) : (
        "Ask the founder to add an Anthropic key in Settings."
      )}
    </Alert>
  );
}

/** Two ways to add work, closed until you ask: one task by hand, or several generated by AI from a goal or pasted notes. */
export function AddPanel({ slug, brandId, members, withAi, canSetKey }: { slug: string; brandId: string; members: Member[]; withAi: boolean; canSetKey: boolean }) {
  const [mode, setMode] = useState<Mode>(null);
  const toggle = (m: Exclude<Mode, null>) => setMode((cur) => (cur === m ? null : m));
  return (
    <div className="mb-8">
      <div className="flex flex-wrap gap-3">
        <Btn variant={mode === "new" ? "dark" : "primary"} aria-expanded={mode === "new"} aria-controls="add-panel" onClick={() => toggle("new")}>
          <Plus className="size-4" aria-hidden />
          New task
        </Btn>
        <Btn variant="secondary" aria-expanded={mode === "ai"} aria-controls="add-panel" onClick={() => toggle("ai")}>
          <Sparkles className="size-4" aria-hidden />
          Generate with AI
        </Btn>
      </div>
      {mode && (
        <div id="add-panel" className="mt-4 rounded-card border border-hairline bg-paper-0 p-5 shadow-raised sm:p-6">
          {mode === "new" ? <NewTaskForm brandId={brandId} members={members} /> : withAi ? <DraftForm brandId={brandId} /> : <NoKey slug={slug} canSetKey={canSetKey} />}
        </div>
      )}
    </div>
  );
}
