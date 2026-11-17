"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Mail, Phone } from "lucide-react";
import { Alert, Btn, Chip } from "@/components/brand/primitives";
import { labelCls, textareaCls } from "@/components/brand/styles";
import { compactField } from "@/components/hub/tasks/parts";
import type { FormState } from "@/lib/hub/actions";
import { addCandidates, findLeads, skipCandidates } from "@/lib/hub/leads-actions";
import { AI_TAG, FIND, SITE_LABEL, preTicked, type Candidate } from "@/lib/hub/leads/consts";
import { cn } from "@/lib/utils";

/** Describe the kind of business to find. The search takes up to a minute. */
export function FinderForm({ brandId }: { brandId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(findLeads, {});
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="brandId" value={brandId} />
      {state.error && (
        <Alert tone="bad" role="alert">
          {state.error}
        </Alert>
      )}
      <div>
        <label htmlFor="lf-what" className={labelCls}>
          What kind of business?
        </label>
        <textarea id="lf-what" name="what" rows={3} required minLength={8} maxLength={FIND.what} placeholder="Cafes and coffee shops that sell beans online, with a working website" className={textareaCls} />
      </div>
      <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor="lf-where" className={labelCls}>
            Where (optional)
          </label>
          <input id="lf-where" name="where" maxLength={FIND.where} autoComplete="off" placeholder="Surabaya and nearby" className={cn(compactField, "h-12 w-full")} />
        </div>
        <div>
          <label htmlFor="lf-count" className={labelCls}>
            How many
          </label>
          <select id="lf-count" name="count" defaultValue={FIND.defaultCount} className={cn(compactField, "h-12 w-full sm:w-28")}>
            {FIND.counts.map((n) => (
              <option key={n} value={n}>
                Up to {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="lf-offer" className={labelCls}>
          What do you offer them? (optional)
        </label>
        <textarea id="lf-offer" name="offer" rows={2} maxLength={FIND.offer} placeholder="Packaging and delivery for small roasters. Skip chains with more than 10 outlets." className={textareaCls} />
        <p className="mt-2 text-caption text-ink-500">Helps the AI pick businesses that fit, and skip the ones you do not want.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Btn type="submit" variant="primary" size="lg" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Search the web
        </Btn>
        {pending && (
          <p role="status" className="text-small text-ink-500">
            Searching, then opening each business&apos;s website. This takes up to two minutes: please keep this page open.
          </p>
        )}
      </div>
    </form>
  );
}

const shortHost = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

function Site({ c }: { c: Candidate }) {
  return (
    <a href={c.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-small text-ink-500 underline decoration-ink-200 underline-offset-2 hover:text-ink-800 focus-visible:shadow-focus focus-visible:outline-none">
      {shortHost(c.website)}
      <ExternalLink className="size-3.5" aria-hidden />
      <span className="sr-only">(opens their website in a new tab)</span>
    </a>
  );
}

/** The businesses a search found: tick the ones to add to the CRM, skip the rest. */
export function Candidates({ brandId, searchId, candidates }: { brandId: string; searchId: string; candidates: Candidate[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const waiting = candidates.filter((c) => c.status === "new");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(candidates.filter(preTicked).map((c) => c.id)));
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const chosen = waiting.filter((c) => picked.has(c.id)).map((c) => c.id);

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  const run = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) =>
    start(async () => {
      setNote(null);
      const r = await fn();
      setNote(r.ok ? { tone: "ok", text: r.message } : { tone: "bad", text: r.error });
      if (r.ok) {
        setPicked(new Set());
        router.refresh();
      }
    });

  const rows = candidates;
  return (
    <div className="space-y-4">
      {note && (
        <Alert tone={note.tone} role={note.tone === "ok" ? "status" : "alert"}>
          {note.text}
        </Alert>
      )}
      {waiting.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex w-fit cursor-pointer items-center gap-3 text-small text-ink-500">
            <input type="checkbox" checked={chosen.length === waiting.length} onChange={(e) => setPicked(e.target.checked ? new Set(waiting.map((c) => c.id)) : new Set())} disabled={pending} className="size-5 accent-ink-800" />
            Select all {waiting.length}
          </label>
          <span className="flex-1" />
          <Btn variant="primary" size="md" disabled={pending || chosen.length === 0} onClick={() => run(() => addCandidates({ brandId, searchId, ids: chosen }))}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Add {chosen.length} to the CRM
          </Btn>
          <Btn variant="secondary" size="md" disabled={pending || chosen.length === 0} onClick={() => run(() => skipCandidates({ brandId, searchId, ids: chosen }))}>
            Skip {chosen.length}
          </Btn>
        </div>
      )}
      <ul className="divide-y divide-hairline rounded-bubble border border-hairline bg-paper-0">
        {rows.map((c) => (
          <li key={c.id} className={cn("flex items-start gap-4 px-5 py-4", c.status !== "new" && "bg-paper-100")}>
            <label className="mt-1 shrink-0 cursor-pointer">
              <span className="sr-only">Select {c.company}</span>
              <input type="checkbox" checked={c.status === "new" && picked.has(c.id)} onChange={() => toggle(c.id)} disabled={pending || c.status !== "new"} className="size-5 accent-ink-800" />
            </label>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-body font-semibold text-ink-800">{c.company}</span>
                {c.location && <span className="text-small text-ink-500">{c.location}</span>}
                <Site c={c} />
              </div>
              {c.why && <p className="text-small text-ink-800">{c.why}</p>}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-ink-500">
                {c.emails.map((e) => (
                  <span key={e} className="inline-flex items-center gap-1.5">
                    <Mail className="size-3.5" aria-hidden />
                    {e}
                  </span>
                ))}
                {c.phones.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1.5">
                    <Phone className="size-3.5" aria-hidden />
                    {p}
                  </span>
                ))}
                {c.emails.length === 0 && c.phones.length === 0 && <span>No email or phone on their site</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {c.site !== "ok" && <Chip tone="warn">{SITE_LABEL[c.site]}</Chip>}
                {c.status === "added" && <Chip tone="ok">Added to the CRM</Chip>}
                {c.status === "skipped" && <Chip tone="neutral">Skipped</Chip>}
                {c.sourceUrl && (
                  <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-caption text-ink-500 underline decoration-ink-200 underline-offset-2 hover:text-ink-800 focus-visible:shadow-focus focus-visible:outline-none">
                    Where it was found
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {waiting.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-caption text-ink-500">
            Added businesses become leads tagged &ldquo;{AI_TAG}&rdquo;, with the website and why it fits in the note. Businesses you skip are not shown again in later searches.
          </p>
          <Btn variant="secondary" size="md" disabled={pending} onClick={() => run(() => skipCandidates({ brandId, searchId }))}>
            Skip all {waiting.length} that are left
          </Btn>
        </div>
      )}
    </div>
  );
}
