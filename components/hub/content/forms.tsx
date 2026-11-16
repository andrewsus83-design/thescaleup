"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { labelCls, textareaCls } from "@/components/brand/styles";
import { compactField } from "@/components/hub/tasks/parts";
import type { FormState } from "@/lib/hub/actions";
import { deleteItem, saveItem, writeContent } from "@/lib/hub/content-actions";
import type { ContentItem } from "@/lib/hub/content/data";
import { CHANNELS, CHANNEL_LABEL, KINDS, KIND_LABEL, MAX, STATUSES, STATUS_LABEL, TEMPLATES, type Channel, type Kind, type Status } from "@/lib/hub/content/model";
import { cn } from "@/lib/utils";

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

/** One piece: write a new one (no `item`) or change an existing one. Fields are controlled, so a save never resets what was typed. */
export function ItemForm({ brandId, item, day }: { brandId: string; item?: ContentItem; day?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveItem, {});
  const [title, setTitle] = useState(item?.title ?? "");
  const [kind, setKind] = useState<Kind>(item?.kind ?? "post");
  const [channel, setChannel] = useState<Channel | "">(item?.channel ?? "");
  const [status, setStatus] = useState<Status>(item?.status ?? "draft");
  const [date, setDate] = useState(item?.scheduled_for ?? day ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="brandId" value={brandId} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <Notice state={state} />
      <div>
        <label htmlFor="ci-title" className={labelCls}>
          Title
        </label>
        <input id="ci-title" name="title" required maxLength={MAX.title} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Friday reel: the new menu" className={cn(compactField, "h-12 w-full")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className={labelCls}>Kind</span>
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={cn(compactField, "w-full")}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Channel</span>
          <select name="channel" value={channel} onChange={(e) => setChannel(e.target.value as Channel | "")} className={cn(compactField, "w-full")}>
            <option value="">No channel</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Status</span>
          <select name="status" value={status} onChange={(e) => setStatus(e.target.value as Status)} className={cn(compactField, "w-full")}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Day</span>
          <input type="date" name="scheduledFor" value={date} onChange={(e) => setDate(e.target.value)} className={cn(compactField, "w-full")} />
        </label>
      </div>
      <div>
        <label htmlFor="ci-body" className={labelCls}>
          Text
        </label>
        <textarea id="ci-body" name="body" rows={14} maxLength={MAX.body} value={body} onChange={(e) => setBody(e.target.value)} className={textareaCls} />
        <p className="mt-2 text-caption text-ink-500">
          Nothing is posted from here yet: copy the text to the channel and set the status to Posted.
          <span className="ml-2 font-mono">
            {body.length.toLocaleString("en-US")}/{MAX.body.toLocaleString("en-US")}
          </span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Btn type="submit" variant="primary" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-label="Saving" /> : item ? "Save" : "Add to the calendar"}
        </Btn>
      </div>
    </form>
  );
}

/** Deleting asks first, in place, with a button that says what it removes. */
export function DeleteItem({ brandId, id, title }: { brandId: string; id: string; title: string }) {
  return (
    <details className="mt-8 border-t border-hairline pt-4">
      <summary className="hit-44 inline-flex min-h-11 cursor-pointer items-center text-small font-semibold text-ink-500 hover:text-ink-800">Delete this piece</summary>
      <form action={deleteItem} className="mt-2 space-y-3 rounded-field bg-paper-100 p-4">
        <input type="hidden" name="brandId" value={brandId} />
        <input type="hidden" name="id" value={id} />
        <p className="text-small text-ink-800">
          “{title.length > 60 ? `${title.slice(0, 59)}…` : title}” is removed for everyone and cannot be brought back.
        </p>
        <Btn type="submit" variant="danger" size="sm">
          Delete it
        </Btn>
      </form>
    </details>
  );
}

/** Pick what to write, say what it is about, and Claude saves a draft you can edit. */
export function WriteForm({ brandId }: { brandId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(writeContent, {});
  const [template, setTemplate] = useState<Kind>("post");
  const [len, setLen] = useState(0);
  const t = TEMPLATES.find((x) => x.id === template) ?? TEMPLATES[0];
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="brandId" value={brandId} />
      <Notice state={state} />
      <fieldset>
        <legend className={labelCls}>What do you need?</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((x) => (
            <label key={x.id} className="relative block">
              <input type="radio" name="template" value={x.id} checked={template === x.id} onChange={() => setTemplate(x.id)} className="peer sr-only" />
              <span className="block min-h-16 cursor-pointer rounded-field border-control border-ink-200 bg-paper-0 px-4 py-3 peer-checked:border-ink-800 peer-checked:bg-paper-100 peer-focus-visible:shadow-focus">
                <span className="block text-body font-semibold text-ink-800">{x.label}</span>
                <span className="block text-caption text-ink-500">{x.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {t.usesChannel && (
        <label className="block max-w-xs">
          <span className={labelCls}>Channel</span>
          <select name="channel" defaultValue="" className={cn(compactField, "w-full")}>
            <option value="">Any channel</option>
            {CHANNELS.filter((c) => c !== "email" && c !== "blog").map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
      )}
      <div>
        <label htmlFor="cw-brief" className={labelCls}>
          What is it about?
        </label>
        <textarea
          id="cw-brief"
          name="brief"
          required
          rows={6}
          maxLength={MAX.brief}
          onChange={(e) => setLen(e.target.value.length)}
          placeholder={template === "reply" ? "Customer: “Is the nasi box still available for Saturday?” We have 20 left and orders close Friday 3 pm." : "Launch of the new lunch menu on Friday. Three dishes, from 35k. Dine-in and delivery."}
          className={textareaCls}
        />
        <p className="mt-2 text-caption text-ink-500">
          Give the facts: prices, dates, what to say. Claude does not invent them and leaves a [placeholder] where one is missing. It saves a draft you can edit. Do not paste passwords or customers&apos; personal details.
          <span className="ml-2 font-mono">
            {len.toLocaleString("en-US")}/{MAX.brief.toLocaleString("en-US")}
          </span>
        </p>
      </div>
      <Btn type="submit" variant="dark" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-label="Writing" /> : "Write a draft"}
      </Btn>
    </form>
  );
}

export function BackToCalendar({ slug }: { slug: string }) {
  return (
    <Link href={`/hub/b/${slug}/content`} className="text-small font-semibold text-brand-700 underline underline-offset-4">
      Back to the calendar
    </Link>
  );
}
