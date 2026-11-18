"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { labelCls, textareaCls } from "@/components/brand/styles";
import { compactField } from "@/components/hub/tasks/parts";
import type { FormState } from "@/lib/hub/actions";
import { answerBuild, startBuild } from "@/lib/hub/wiki-ai-actions";
import { BUILD_LIMITS, SOCIALS, type Question } from "@/lib/hub/wiki/build";
import { cn } from "@/lib/utils";

/** Step 1: where to read about the brand. */
export function StartForm({ brandId, website, handles }: { brandId: string; website?: string; handles?: Partial<Record<string, string>> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(startBuild, {});
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="brandId" value={brandId} />
      {state.error && (
        <Alert tone="bad" role="alert">
          {state.error}
        </Alert>
      )}
      <div>
        <label htmlFor="wb-website" className={labelCls}>
          Website
        </label>
        <input id="wb-website" name="website" inputMode="url" autoComplete="off" defaultValue={website ?? ""} placeholder="brand.com" className={cn(compactField, "h-12 w-full")} />
        <p className="mt-2 text-caption text-ink-500">The home page, plus up to {BUILD_LIMITS.perPage} pages such as About, Products, Prices and FAQ.</p>
      </div>
      <fieldset>
        <legend className={labelCls}>Social accounts</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {SOCIALS.map((s) => (
            <div key={s.id}>
              <label htmlFor={`wb-${s.id}`} className="mb-1 block text-small text-ink-500">
                {s.label}
              </label>
              <input id={`wb-${s.id}`} name={s.id} autoComplete="off" defaultValue={handles?.[s.id] ?? ""} placeholder="@brand or the link" className={cn(compactField, "w-full")} />
            </div>
          ))}
        </div>
        <p className="mt-2 text-caption text-ink-500">Social sites often block automatic reading and show little without a login. If one comes back empty, paste its bio and a few captions below.</p>
      </fieldset>
      <div>
        <label htmlFor="wb-notes" className={labelCls}>
          Anything else (optional)
        </label>
        <textarea id="wb-notes" name="notes" rows={5} maxLength={BUILD_LIMITS.notes} placeholder="A brand brief, an about text, what the client said on a call, a price list…" className={textareaCls} />
        <p className="mt-2 text-caption text-ink-500">Do not paste passwords or keys.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Btn type="submit" variant="primary" size="lg" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Read and ask questions
        </Btn>
        {pending && (
          <p role="status" className="text-small text-ink-500">
            Reading the sources. This takes about a minute: please keep this page open.
          </p>
        )}
      </div>
    </form>
  );
}

/** Step 2: the questions. Answers can be saved and finished later; "Write the pages" drafts the pages from what is there. */
export function AnswerForm({ brandId, id, questions, answers, again }: { brandId: string; id: string; questions: Question[]; answers: Record<string, string>; again?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(answerBuild, {});
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="id" value={id} />
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
      {questions.length === 0 ? (
        <p className="text-body text-ink-800">The sources already cover what the Wiki needs, so there is nothing to ask. You can write the pages now.</p>
      ) : (
        <ol className="space-y-6">
          {questions.map((q, i) => (
            <li key={q.id}>
              <label htmlFor={`a-${q.id}`} className="mb-2 block text-body font-semibold text-ink-800">
                {i + 1}. {q.q}
              </label>
              {q.why && <p className="mb-2 text-caption text-ink-500">{q.why}</p>}
              <textarea id={`a-${q.id}`} name={`a-${q.id}`} rows={3} maxLength={BUILD_LIMITS.answer} defaultValue={answers[q.id] ?? ""} className={textareaCls} />
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Btn type="submit" name="intent" value="write" variant="primary" size="lg" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {again ? "Write the pages again" : "Write the pages"}
        </Btn>
        {questions.length > 0 && (
          <Btn type="submit" name="intent" value="save" variant="secondary" size="lg" disabled={pending}>
            Save answers for later
          </Btn>
        )}
      </div>
      {pending && (
        <p role="status" className="text-small text-ink-500">
          Writing the pages. This takes a minute or two: please keep this page open.
        </p>
      )}
      <p className="text-caption text-ink-500">Unanswered questions are skipped. The pages say &ldquo;To confirm&rdquo; where something is missing, instead of guessing.</p>
    </form>
  );
}
