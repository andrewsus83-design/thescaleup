"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { Alert, Btn, Chip } from "@/components/brand/primitives";
import { labelCls, textareaCls } from "@/components/brand/styles";
import { compactField } from "@/components/hub/tasks/parts";
import type { FormState } from "@/lib/hub/actions";
import { draftProfile, saveProfile } from "@/lib/hub/brand-profile-actions";
import { BUYERS, BUYERS_LABEL, PROFILE_TOTAL, TEXT_FIELDS, filledCount, type Buyers, type DraftState, type ProfileValue, type TextKey } from "@/lib/hub/brand-profile/model";
import { BUILD_LIMITS, SOCIALS } from "@/lib/hub/wiki/build";
import { cn } from "@/lib/utils";

type Key = TextKey | "buyers";
type Mark = "ai" | "check";

type Props = {
  brandId: string;
  canEdit: boolean;
  hasKey: boolean;
  version: number;
  initial: ProfileValue;
  /** Where the Wiki builder lives, or null when this person cannot use it. */
  wikiHref: string | null;
};

/** The brand profile: filled by hand, or drafted by the AI from the website and social accounts and then checked and saved by a person. */
export function ProfileEditor({ brandId, canEdit, hasKey, version, initial, wikiHref }: Props) {
  const [website, setWebsite] = useState(initial.website ?? "");
  const [handles, setHandles] = useState<Record<string, string>>({ ...initial.handles });
  const [notes, setNotes] = useState("");
  const [fields, setFields] = useState<Record<TextKey, string>>(initial.fields);
  const [buyers, setBuyers] = useState<Buyers | "">(initial.buyers);
  const [marks, setMarks] = useState<Partial<Record<Key, Mark>>>({});
  const [suggest, setSuggest] = useState<Partial<Record<Key, string>>>({});
  const [blank, setBlank] = useState<ReadonlySet<string>>(new Set());
  const [applied, setApplied] = useState<number | undefined>();
  const [aiState, aiAction, drafting] = useActionState<DraftState, FormData>(draftProfile, {});
  const [saveState, saveAction, saving] = useActionState<FormState, FormData>(saveProfile, {});

  // A new draft from the AI: fill the empty answers, and offer (never force) a different text where the person already wrote one.
  if (aiState.stamp && aiState.stamp !== applied && aiState.draft) {
    const d = aiState.draft;
    const nextFields = { ...fields };
    const nextMarks: Partial<Record<Key, Mark>> = {};
    const nextSuggest: Partial<Record<Key, string>> = {};
    for (const f of TEXT_FIELDS) {
      const v = d.fields[f.key];
      if (!v) continue;
      if (!fields[f.key].trim()) {
        nextFields[f.key] = v;
        nextMarks[f.key] = d.unsure.includes(f.key) ? "check" : "ai";
      } else if (fields[f.key].trim() !== v) nextSuggest[f.key] = v;
    }
    if (d.buyers) {
      if (!buyers) {
        setBuyers(d.buyers);
        nextMarks.buyers = "ai";
      } else if (buyers !== d.buyers) nextSuggest.buyers = BUYERS_LABEL[d.buyers];
    }
    setApplied(aiState.stamp);
    setFields(nextFields);
    setMarks(nextMarks);
    setSuggest(nextSuggest);
    setBlank(new Set(d.unsure.filter((k) => (k === "buyers" ? !d.buyers : !d.fields[k as TextKey]))));
  }

  const answered = filledCount({ ...initial, fields, buyers });
  const takeSuggestion = (k: TextKey) => {
    const v = suggest[k];
    if (!v) return;
    setFields((f) => ({ ...f, [k]: v }));
    setMarks((m) => ({ ...m, [k]: "ai" }));
    setSuggest((s) => ({ ...s, [k]: undefined }));
  };

  if (!canEdit) {
    const shown = TEXT_FIELDS.filter((f) => initial.fields[f.key]);
    return (
      <div className="space-y-6">
        <Alert tone="info">You can read the brand profile here but not change it.</Alert>
        {initial.buyers || shown.length ? (
          <dl className="space-y-5">
            {shown.map((f) => (
              <div key={f.key}>
                <dt className="text-small font-semibold text-ink-500">{f.label}</dt>
                <dd className="mt-1 whitespace-pre-line text-body text-ink-800">{initial.fields[f.key]}</dd>
              </div>
            ))}
            {initial.buyers && (
              <div>
                <dt className="text-small font-semibold text-ink-500">Who buys: businesses or individuals</dt>
                <dd className="mt-1 text-body text-ink-800">{BUYERS_LABEL[initial.buyers]}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-body text-ink-500">Nothing has been filled in yet.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="bp-ai" className="space-y-5">
        <div>
          <h2 id="bp-ai" className="flex items-center gap-2 font-title text-h3 text-ink-800">
            <Sparkles className="size-5 text-ink-500" aria-hidden />
            Fill it in with AI
          </h2>
          <p className="mt-1 text-small text-ink-500">Give it the brand&apos;s links. It reads them and drafts the answers below. Nothing is saved until you press Save.</p>
        </div>
        {!hasKey && <Alert tone="warn">AI needs an Anthropic key. Add one in Settings → Integrations first. You can still fill the profile in by hand.</Alert>}
        {aiState.error && (
          <Alert tone="bad" role="alert">
            {aiState.error}
          </Alert>
        )}
        {aiState.message && !aiState.error && (
          <Alert tone="ok" role="status">
            {aiState.message}
          </Alert>
        )}
        <form action={aiAction} className="space-y-5">
          <input type="hidden" name="brandId" value={brandId} />
          <div>
            <label htmlFor="bp-website" className={labelCls}>
              Website
            </label>
            <input id="bp-website" name="website" inputMode="url" autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="brand.com" className={cn(compactField, "h-12 w-full")} />
          </div>
          <fieldset>
            <legend className={labelCls}>Social accounts</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {SOCIALS.map((s) => (
                <div key={s.id}>
                  <label htmlFor={`bp-${s.id}`} className="mb-1 block text-small text-ink-500">
                    {s.label}
                  </label>
                  <input
                    id={`bp-${s.id}`}
                    name={s.id}
                    autoComplete="off"
                    value={handles[s.id] ?? ""}
                    onChange={(e) => setHandles((h) => ({ ...h, [s.id]: e.target.value }))}
                    placeholder="@brand or the link"
                    className={cn(compactField, "w-full")}
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 text-caption text-ink-500">Social sites often block automatic reading. If one comes back empty, paste its bio and a few captions below.</p>
          </fieldset>
          <div>
            <label htmlFor="bp-notes" className={labelCls}>
              Anything else (optional)
            </label>
            <textarea id="bp-notes" name="notes" rows={4} maxLength={BUILD_LIMITS.notes} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="A brand brief, an about text, a price list, what the client said on a call…" className={textareaCls} />
            <p className="mt-2 text-caption text-ink-500">Do not paste passwords or keys. These notes are only used for this draft and are not saved.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Btn type="submit" variant="secondary" size="lg" disabled={drafting || !hasKey}>
              {drafting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Read and fill in
            </Btn>
            {drafting && (
              <p role="status" className="text-small text-ink-500">
                Reading the sources. This takes up to a minute: please keep this page open.
              </p>
            )}
          </div>
        </form>
        {aiState.read && aiState.read.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="What was read">
            {aiState.read.map((r, i) => (
              <li key={`${r.label}-${i}`} title={r.note || undefined}>
                <Chip tone={r.ok ? "ok" : "warn"}>
                  {r.label}: {r.ok ? "read" : "could not read"}
                </Chip>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="bp-profile" className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="bp-profile" className="font-title text-h3 text-ink-800">
            The profile
          </h2>
          <p className="text-small text-ink-500">
            {answered} of {PROFILE_TOTAL} answered
          </p>
        </div>
        <p className="text-small text-ink-500">Short and plain is best. The AI features read this before they write or search, so only put in what is true today. Leave a field empty if you are not sure.</p>
        {saveState.error && (
          <Alert tone="bad" role="alert">
            {saveState.error}
          </Alert>
        )}
        {saveState.message && !saveState.error && (
          <Alert tone="ok" role="status">
            {saveState.message}
          </Alert>
        )}
        <form action={saveAction} className="space-y-6">
          <input type="hidden" name="brandId" value={brandId} />
          <input type="hidden" name="version" value={version} />
          <input type="hidden" name="website" value={website} />
          {SOCIALS.map((s) => (
            <input key={s.id} type="hidden" name={s.id} value={handles[s.id] ?? ""} />
          ))}
          {TEXT_FIELDS.map((f) => (
            <div key={f.key}>
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <label htmlFor={`bp-f-${f.key}`} className="text-body font-semibold text-ink-800">
                  {f.label}
                </label>
                {marks[f.key] === "ai" && <Chip tone="info">Filled by AI: check it</Chip>}
                {marks[f.key] === "check" && <Chip tone="warn">The AI was not sure: check it</Chip>}
              </div>
              <p className="mb-2 text-caption text-ink-500">{f.hint}</p>
              {f.rows <= 1 ? (
                <input id={`bp-f-${f.key}`} name={f.key} maxLength={f.max} autoComplete="off" value={fields[f.key]} onChange={(e) => setFields((v) => ({ ...v, [f.key]: e.target.value }))} placeholder={f.placeholder} className={cn(compactField, "h-12 w-full")} />
              ) : (
                <textarea id={`bp-f-${f.key}`} name={f.key} rows={f.rows} maxLength={f.max} value={fields[f.key]} onChange={(e) => setFields((v) => ({ ...v, [f.key]: e.target.value }))} placeholder={f.placeholder} className={textareaCls} />
              )}
              {blank.has(f.key) && !fields[f.key].trim() && <p className="mt-2 text-caption text-ink-500">The sources did not say. Fill this in if you know.</p>}
              {suggest[f.key] && (
                <div className="mt-2 rounded-field bg-paper-100 px-4 py-3">
                  <p className="text-small font-semibold text-ink-800">The AI suggests this instead</p>
                  <p className="mt-1 whitespace-pre-line text-small text-ink-700">{suggest[f.key]}</p>
                  <button type="button" onClick={() => takeSuggestion(f.key)} className="mt-2 rounded-field text-small font-semibold text-brand-700 underline underline-offset-4 focus-visible:shadow-focus focus-visible:outline-none">
                    Use this text
                  </button>
                </div>
              )}
              {f.key === "who" && (
                <div className="mt-5">
                  <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <label htmlFor="bp-buyers" className="text-body font-semibold text-ink-800">
                      Do businesses or individuals buy it?
                    </label>
                    {marks.buyers === "ai" && <Chip tone="info">Filled by AI: check it</Chip>}
                  </div>
                  <select id="bp-buyers" name="buyers" value={buyers} onChange={(e) => setBuyers(e.target.value as Buyers | "")} className={cn(compactField, "h-12 w-full sm:w-64")}>
                    <option value="">Not set</option>
                    {BUYERS.map((b) => (
                      <option key={b} value={b}>
                        {BUYERS_LABEL[b]}
                      </option>
                    ))}
                  </select>
                  {blank.has("buyers") && !buyers && <p className="mt-2 text-caption text-ink-500">The sources did not say. Pick one if you know.</p>}
                  {suggest.buyers && <p className="mt-2 text-caption text-ink-500">The AI read it as: {suggest.buyers}.</p>}
                  {buyers === "individuals" && <p className="mt-2 text-caption text-ink-500">The leads finder lists businesses, not people. For individual buyers it is best used to find partners and referrers, such as brokers, employers, communities and venues.</p>}
                </div>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Btn type="submit" variant="primary" size="lg" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save profile
            </Btn>
            {wikiHref && (
              <Link href={wikiHref} className="text-small font-semibold text-brand-700 underline underline-offset-4">
                Build Wiki pages from the same links
              </Link>
            )}
          </div>
          {wikiHref && <p className="text-caption text-ink-500">Save first: the Wiki builder starts from the website and accounts saved here.</p>}
        </form>
      </section>
    </div>
  );
}
