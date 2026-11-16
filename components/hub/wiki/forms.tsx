"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { labelCls, segItem, segWrap, textareaCls } from "@/components/brand/styles";
import { compactField } from "@/components/hub/tasks/parts";
import type { FormState } from "@/lib/hub/actions";
import { deletePage, savePage } from "@/lib/hub/wiki-actions";
import type { WikiPage } from "@/lib/hub/wiki/data";
import { MAX, TYPES, TYPE_INFO, aiDefault, secretHint, type PageType } from "@/lib/hub/wiki/model";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

export type ParentOption = { id: string; title: string; depth: number };

/** One page: write a new one (no `page`) or change an existing one. Fields are controlled, so a failed save never loses what was typed. */
export function PageForm({ brandId, parents, page, parentId, cancelHref }: { brandId: string; parents: ParentOption[]; page?: WikiPage; parentId?: string; cancelHref: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePage, {});
  const [title, setTitle] = useState(page?.title ?? "");
  const [summary, setSummary] = useState(page?.summary ?? "");
  const [type, setType] = useState<PageType>(page?.type ?? "other");
  const [parent, setParent] = useState(page?.parent_id ?? (parentId && parents.some((p) => p.id === parentId) ? parentId : ""));
  const [tags, setTags] = useState((page?.tags ?? []).join(", "));
  const [body, setBody] = useState(page?.body ?? "");
  const [ai, setAi] = useState(page?.ai_readable ?? aiDefault("other"));
  const [aiTouched, setAiTouched] = useState(false);
  const [preview, setPreview] = useState(false);

  // On a new page, choosing a type fills in a starting outline (while the text is empty or still the last outline) and sets the AI switch to that type's default (until the person changes it).
  function pickType(next: PageType) {
    if (!page) {
      if (!aiTouched) setAi(aiDefault(next));
      if (!body.trim() || body === TYPE_INFO[type].starter) setBody(TYPE_INFO[next].starter);
    }
    setType(next);
  }

  const secret = secretHint(`${title}\n${summary}\n${body}`);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="brandId" value={brandId} />
      {page && <input type="hidden" name="id" value={page.id} />}
      {state.error && (
        <Alert tone="bad" role="alert">
          {state.error}
        </Alert>
      )}
      <div>
        <label htmlFor="wk-title" className={labelCls}>
          Title
        </label>
        <input id="wk-title" name="title" required maxLength={MAX.title} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How we reply to a complaint" className={cn(compactField, "h-12 w-full")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls}>Type</span>
          <select name="type" value={type} onChange={(e) => pickType(e.target.value as PageType)} className={cn(compactField, "w-full")}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_INFO[t].label}
              </option>
            ))}
          </select>
          <span className="mt-2 block text-caption text-ink-500">{TYPE_INFO[type].hint}</span>
        </label>
        <label className="block">
          <span className={labelCls}>Goes under</span>
          <select name="parentId" value={parent} onChange={(e) => setParent(e.target.value)} className={cn(compactField, "w-full")}>
            <option value="">Top level</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {"  ".repeat(p.depth)}
                {p.depth > 0 ? "↳ " : ""}
                {p.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <label htmlFor="wk-summary" className={labelCls}>
          One-line summary
        </label>
        <input id="wk-summary" name="summary" maxLength={MAX.summary} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Shown in lists and search results" className={cn(compactField, "h-12 w-full")} />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="wk-body" className="text-small font-semibold text-ink-800">
            Text
          </label>
          <div className={segWrap} role="group" aria-label="Write or preview">
            <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)} className={segItem(!preview, "sm")}>
              Write
            </button>
            <button type="button" aria-pressed={preview} onClick={() => setPreview(true)} className={segItem(preview, "sm")}>
              Preview
            </button>
          </div>
        </div>
        <textarea id="wk-body" name="body" rows={18} maxLength={MAX.body} value={body} onChange={(e) => setBody(e.target.value)} className={cn(textareaCls, "font-mono text-small", preview && "hidden")} />
        {preview && (
          <div className="min-h-40 rounded-field border-control border-ink-200 bg-paper-0 p-5">
            <Markdown text={body} />
          </div>
        )}
        <p className="mt-2 text-caption text-ink-500">
          Markdown works: ## headings, **bold**, - lists, [links](https://…), tables. Never put passwords, salaries or private personal details here.
          <span className="ml-2 font-mono">
            {body.length.toLocaleString("en-US")}/{MAX.body.toLocaleString("en-US")}
          </span>
        </p>
        {secret && (
          <Alert tone="warn" role="status" className="mt-3">
            {secret}
          </Alert>
        )}
      </div>
      <div>
        <label htmlFor="wk-tags" className={labelCls}>
          Tags
        </label>
        <input id="wk-tags" name="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="onboarding, sales, q4 plan" className={cn(compactField, "h-12 w-full")} />
        <p className="mt-2 text-caption text-ink-500">Separate with commas. Up to {MAX.tags}.</p>
      </div>
      <label className="flex items-start gap-3 rounded-field bg-paper-100 p-4">
        <input
          type="checkbox"
          name="aiReadable"
          checked={ai}
          onChange={(e) => {
            setAi(e.target.checked);
            setAiTouched(true);
          }}
          className="mt-1 size-5 shrink-0 accent-ink-800"
        />
        <span>
          <span className="block text-small font-semibold text-ink-800">AI may read this page</span>
          <span className="block text-caption text-ink-500">
            {type === "person" ? "Off for people and roles unless you turn it on." : "On unless you turn it off."} People on your team can read the page either way. Search engines never can.
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Btn type="submit" variant="primary" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-label="Saving" /> : page ? "Save" : "Add page"}
        </Btn>
        <Link href={cancelHref} className="text-small font-semibold text-brand-700 underline underline-offset-4">
          Cancel
        </Link>
      </div>
    </form>
  );
}

/** Deleting asks first, in place, with a button that says what it removes. */
export function DeletePage({ brandId, id, title, subpages }: { brandId: string; id: string; title: string; subpages: number }) {
  return (
    <details className="mt-8 border-t border-hairline pt-4">
      <summary className="hit-44 inline-flex min-h-11 cursor-pointer items-center text-small font-semibold text-ink-500 hover:text-ink-800">Delete this page</summary>
      <form action={deletePage} className="mt-2 space-y-3 rounded-field bg-paper-100 p-4">
        <input type="hidden" name="brandId" value={brandId} />
        <input type="hidden" name="id" value={id} />
        <p className="text-small text-ink-800">
          “{title.length > 60 ? `${title.slice(0, 59)}…` : title}” and its earlier versions are removed for everyone and cannot be brought back.
          {subpages > 0 && ` Its ${subpages === 1 ? "subpage stays" : `${subpages} subpages stay`} and move to the top level.`}
        </p>
        <Btn type="submit" variant="danger" size="sm">
          Delete it
        </Btn>
      </form>
    </details>
  );
}
