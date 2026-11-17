"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Eye, Loader2, Plus, Trash2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { inputCls, labelCls, pillCls, segItem, segWrap, textareaCls } from "@/components/brand/styles";
import { sendSequenceTest, saveSequence } from "@/lib/hub/sequence-actions";
import { DEFAULT_ACCENT, EMAIL_LIMITS, emptyDoc, merge, renderEmail, type Audience } from "@/lib/hub/email/model";
import { clampDelay, scheduleText, sequenceProblems, SEQ_LIMITS, SEQ_STARTERS, type Step } from "@/lib/hub/email/sequence-model";
import { cn } from "@/lib/utils";
import { AudiencePicker } from "./audience-picker";
import { DocEditor } from "./doc-editor";

type StageOption = { key: string; label: string };
type Props = {
  brandId: string;
  slug: string;
  brandName: string;
  id?: string;
  /** Someone is already in the sequence, so changing the order or removing an email affects them. */
  hasPeople: boolean;
  initial: { name: string; addressId: string; steps: Step[]; audience: Audience; stopStages: string[] };
  addresses: { id: string; email: string; name: string }[];
  stages: { lead: string[]; client: string[] };
  /** Every stage the brand uses, with the words it calls them. */
  stageOptions: StageOption[];
  tags: { tag: string; n: number }[];
  /** What is missing on the server for sending, in words. Empty when sending works. */
  blocker: string;
};

const SAMPLE = { first_name: "Rina", name: "Rina Wijaya", company: "Maju Jaya" };
const normalise = (steps: Step[]): Step[] => steps.map((s, i) => ({ ...s, delay_days: clampDelay(s.delay_days, i === 0) }));

export function SequenceBuilder({ brandId, slug, brandName, id: id0, hasPeople, initial, addresses, stages, stageOptions, tags, blocker }: Props) {
  const router = useRouter();
  const uid = useId();
  const [id, setId] = useState(id0);
  const [name, setName] = useState(initial.name);
  const [addressId, setAddressId] = useState(initial.addressId);
  const [steps, setSteps] = useState<Step[]>(initial.steps);
  const [audience, setAudience] = useState<Audience>(initial.audience);
  const [stopStages, setStopStages] = useState<string[]>(initial.stopStages);
  const [open, setOpen] = useState(0);
  const [asking, setAsking] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const accent = steps[0]?.doc.accent ?? DEFAULT_ACCENT;
  const footer = steps[0]?.doc.footer ?? "";
  const problems = useMemo(() => sequenceProblems(steps), [steps]);
  const focus = Math.max(0, Math.min(open, steps.length - 1)); // the email shown in the preview and sent as a test, even when all are folded
  const current = steps[focus];
  const preview = useMemo(() => (current ? renderEmail(current.doc, { ...SAMPLE, brand: brandName }, "https://example.com/unsubscribe").html : ""), [current, brandName]);
  const subjectPreview = current ? merge(current.doc.subject, { ...SAMPLE, brand: brandName }) : "";
  const stageList = useMemo(() => [...new Set([...(audience.kinds.includes("lead") ? stages.lead : []), ...(audience.kinds.includes("client") ? stages.client : [])])], [audience.kinds, stages]);
  const blank = steps.length === 0 || (steps.length === 1 && !steps[0].doc.subject && steps[0].doc.blocks.length === 0);
  const labels = useMemo(() => Object.fromEntries(stageOptions.map((s) => [s.key, s.label])), [stageOptions]);

  const edit = <T,>(set: (v: T) => void, v: T) => {
    set(v);
    setDirty(true);
    setMsg(null);
  };
  const setAll = (next: Step[]) => edit(setSteps, normalise(next));
  const setDesign = (patch: { accent?: string; footer?: string }) => setAll(steps.map((s) => ({ ...s, doc: { ...s.doc, ...patch } })));
  const addStep = () => {
    if (steps.length >= SEQ_LIMITS.steps) return;
    setAll([...steps, { delay_days: 3, doc: { ...emptyDoc(), accent, footer, blocks: [{ type: "text", text: "" }] } }]);
    setOpen(steps.length);
  };
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    setAll(next);
    setOpen(j);
  };
  const remove = (i: number) => {
    setAll(steps.filter((_, k) => k !== i));
    setOpen(Math.max(0, Math.min(open, steps.length - 2)));
    setAsking(null);
  };
  const toggleStop = (key: string) => edit(setStopStages, stopStages.includes(key) ? stopStages.filter((k) => k !== key) : [...stopStages, key]);

  const AUTO_OFF = "Automatic adding was switched off because you changed who joins. Switch it on again to confirm the new list.";

  /** Saves, creating the sequence the first time. Returns its id, or null when it could not be saved (the message says why). */
  async function save(): Promise<{ id: string; autoOff: boolean } | null> {
    const r = await saveSequence({ brandId, id, name, addressId, steps, audience, stopStages });
    if (!r.ok) {
      setMsg({ tone: "bad", text: r.error });
      return null;
    }
    setDirty(false);
    if (!id) {
      setId(r.id);
      router.replace(`/hub/b/${slug}/mail/sequences/${r.id}`);
    } else router.refresh();
    return { id: r.id, autoOff: r.autoOff };
  }
  const onSave = () =>
    start(async () => {
      const got = await save();
      if (got) setMsg({ tone: "ok", text: got.autoOff ? `Saved. ${AUTO_OFF}` : "Saved." });
    });
  const onTest = () =>
    start(async () => {
      const got = await save();
      if (!got) return;
      const r = await sendSequenceTest(brandId, got.id, focus);
      setMsg(r.ok ? { tone: "ok", text: `${got.autoOff ? `${AUTO_OFF} ` : ""}Email ${focus + 1} went to ${r.to}. Check your inbox and spam.` } : { tone: "bad", text: r.error });
    });

  return (
    <div className="space-y-6">
      {blocker && (
        <Alert tone="warn" title="Sending is not ready.">
          {blocker} You can still write and save drafts.
        </Alert>
      )}
      {msg && (
        <Alert tone={msg.tone} role={msg.tone === "bad" ? "alert" : "status"}>
          {msg.text}
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 lg:hidden">
        <div className={segWrap} role="tablist" aria-label="Edit or preview">
          {(["edit", "preview"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={segItem(tab === t, "sm")}>
              {t === "edit" ? "Edit" : "Preview"}
            </button>
          ))}
        </div>
        {dirty && <span className="text-caption text-ink-500">Unsaved changes</span>}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
        <div className={cn("space-y-8", tab === "preview" && "hidden lg:block")}>
          {blank && (
            <section aria-labelledby={`${uid}-start`} className="space-y-3">
              <h2 id={`${uid}-start`} className="text-small font-semibold text-ink-800">
                Start from
              </h2>
              <div className="flex flex-wrap gap-2">
                {SEQ_STARTERS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    title={s.hint}
                    onClick={() => {
                      setAll(s.steps.map((x) => ({ ...x, doc: { ...x.doc, accent, footer: footer || x.doc.footer } })));
                      setOpen(0);
                    }}
                    className={pillCls(false)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-4" aria-label="Basics">
            <div>
              <label htmlFor={`${uid}-name`} className={labelCls}>
                Sequence name
              </label>
              <input id={`${uid}-name`} value={name} maxLength={EMAIL_LIMITS.name} onChange={(e) => edit(setName, e.target.value)} placeholder="Welcome series" className={inputCls} />
              <p className="mt-2 text-caption text-ink-500">Only your team sees this.</p>
            </div>
            <div>
              <label htmlFor={`${uid}-from`} className={labelCls}>
                Send from
              </label>
              <select id={`${uid}-from`} value={addressId} onChange={(e) => edit(setAddressId, e.target.value)} className={cn(inputCls, "appearance-auto")}>
                <option value="">Pick an address</option>
                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ? `${a.name} <${a.email}>` : a.email}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-caption text-ink-500">Replies come to this address. Anyone who writes back leaves the sequence.</p>
            </div>
          </section>

          <section className="space-y-4" aria-label="Emails">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-small font-semibold text-ink-800">Emails</h2>
              <p className="text-caption text-ink-500">{scheduleText(steps)}, counted from the day someone joins.</p>
            </div>
            {hasPeople && <p className="rounded-field bg-paper-100 p-4 text-caption text-ink-500">People are already in this sequence. Each carries on from the number of emails they have had, so moving or removing an email changes what they get next.</p>}
            {steps.length === 0 && <p className="rounded-field bg-paper-100 p-4 text-small text-ink-500">No emails yet. Pick a starting point above or add the first one.</p>}
            <ol className="space-y-3">
              {steps.map((s, i) => {
                const isOpen = open === i;
                return (
                  <li key={i} className={cn("rounded-bubble border bg-paper-0", isOpen ? "border-ink-800" : "border-hairline")}>
                    <div className="flex flex-wrap items-center gap-3 p-3">
                      <button type="button" aria-expanded={isOpen} aria-controls={`${uid}-step-${i}`} onClick={() => setOpen(isOpen ? -1 : i)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-full px-2 text-left hover:bg-paper-100">
                        {isOpen ? <ChevronUp className="size-4 shrink-0" aria-hidden /> : <ChevronDown className="size-4 shrink-0" aria-hidden />}
                        <span className="min-w-0">
                          <span className="block text-caption text-ink-500">Email {i + 1}</span>
                          <span className="block truncate text-small font-semibold text-ink-800">{s.doc.subject || "No subject yet"}</span>
                        </span>
                      </button>
                      <label className="flex items-center gap-2 text-small text-ink-800">
                        <span>{i === 0 ? "Wait after joining" : "Wait after email " + i}</span>
                        <input
                          key={`${i}-${s.delay_days}`}
                          type="number"
                          inputMode="numeric"
                          min={i === 0 ? 0 : 1}
                          max={SEQ_LIMITS.delay}
                          defaultValue={s.delay_days}
                          onBlur={(e) => {
                            const n = clampDelay(e.currentTarget.value, i === 0);
                            if (n !== s.delay_days) setAll(steps.map((x, k) => (k === i ? { ...x, delay_days: n } : x)));
                            else e.currentTarget.value = String(n);
                          }}
                          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                          className="h-11 w-20 rounded-full border-control border-ink-200 bg-paper-0 px-3 text-center text-small text-ink-800 outline-none focus-visible:border-ink-800 focus-visible:shadow-focus"
                        />
                        <span>{s.delay_days === 1 ? "day" : "days"}</span>
                      </label>
                      <span className="flex items-center gap-1">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move email ${i + 1} up`} className="hit-44 inline-flex size-11 items-center justify-center rounded-full text-ink-500 hover:bg-paper-100 disabled:opacity-30">
                          <ArrowUp className="size-4" aria-hidden />
                        </button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label={`Move email ${i + 1} down`} className="hit-44 inline-flex size-11 items-center justify-center rounded-full text-ink-500 hover:bg-paper-100 disabled:opacity-30">
                          <ArrowDown className="size-4" aria-hidden />
                        </button>
                        <button type="button" onClick={() => setAsking(i)} aria-label={`Remove email ${i + 1}`} className="hit-44 inline-flex size-11 items-center justify-center rounded-full text-ink-500 hover:bg-paper-100">
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </span>
                    </div>
                    {asking === i && (
                      <div className="mx-3 mb-3 flex flex-wrap items-center gap-3 rounded-field bg-paper-100 px-4 py-2 text-small text-ink-800">
                        Remove email {i + 1} and everything in it?
                        <Btn variant="danger" size="sm" onClick={() => remove(i)}>
                          Yes, remove
                        </Btn>
                        <Btn variant="ghost" size="sm" onClick={() => setAsking(null)}>
                          Keep it
                        </Btn>
                      </div>
                    )}
                    {isOpen && (
                      <div id={`${uid}-step-${i}`} className="border-t border-hairline p-4">
                        <DocEditor doc={s.doc} idPrefix={`${uid}-d${i}`} onChange={(doc) => setAll(steps.map((x, k) => (k === i ? { ...x, doc } : x)))} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            <Btn variant="secondary" onClick={addStep} disabled={steps.length >= SEQ_LIMITS.steps}>
              <Plus className="size-4" aria-hidden />
              Add an email
            </Btn>
            {steps.length >= SEQ_LIMITS.steps && <p className="text-caption text-ink-500">A sequence can have up to {SEQ_LIMITS.steps} emails.</p>}
          </section>

          <section className="space-y-4" aria-label="Style and footer">
            <h2 className="text-small font-semibold text-ink-800">Look of every email</h2>
            <div className="flex items-center gap-4">
              <label htmlFor={`${uid}-accent`} className="text-small font-semibold text-ink-800">
                Accent colour
              </label>
              <input id={`${uid}-accent`} type="color" value={accent} disabled={steps.length === 0} onChange={(e) => setDesign({ accent: e.target.value })} className="size-11 cursor-pointer rounded-full border border-ink-200 bg-paper-0 p-1" />
              <span className="text-caption text-ink-500">Top line and buttons.</span>
            </div>
            <div>
              <label htmlFor={`${uid}-footer`} className={labelCls}>
                Footer: who sends this
              </label>
              <textarea id={`${uid}-footer`} value={footer} disabled={steps.length === 0} maxLength={EMAIL_LIMITS.footer} rows={3} onChange={(e) => setDesign({ footer: e.target.value })} className={textareaCls} />
              <p className="mt-2 text-caption text-ink-500">Your business name and postal address. The unsubscribe link is added for you.</p>
            </div>
          </section>

          <section className="space-y-4" aria-label="Who joins">
            <h2 className="text-small font-semibold text-ink-800">Who joins</h2>
            <AudiencePicker audience={audience} onChange={(a) => edit(setAudience, a)} stageList={stageList} tags={tags} labels={labels} />
            <p className="text-caption text-ink-500">People who unsubscribed, or whose address bounced, are never added.</p>
          </section>

          <section className="space-y-4" aria-label="When people leave">
            <h2 className="text-small font-semibold text-ink-800">When people leave</h2>
            <p className="text-caption text-ink-500">Someone leaves the sequence, and gets no more of it, when they unsubscribe, bounce, write back to you, or are removed from the CRM. You can also end it at a stage:</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Stop at these stages">
              {stageOptions.map((s) => {
                const on = stopStages.includes(s.key);
                return (
                  <button key={s.key} type="button" aria-pressed={on} onClick={() => toggleStop(s.key)} className={pillCls(on)}>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-4 border-t border-hairline pt-6" aria-label="Save">
            {problems.length > 0 && (
              <div className="rounded-field bg-paper-100 p-4">
                <p className="text-small font-semibold text-ink-800">Before it can start</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-small text-ink-800">
                  {problems.slice(0, 6).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                  {problems.length > 6 && <li>And {problems.length - 6} more.</li>}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Btn variant="primary" disabled={pending || !name.trim()} onClick={onSave}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-label="Working" /> : null}
                Save
              </Btn>
              <Btn variant="secondary" disabled={pending || !name.trim() || !addressId || !!blocker || !current} onClick={onTest}>
                Send email {focus + 1} to me as a test
              </Btn>
              {dirty && <span className="hidden text-caption text-ink-500 lg:inline">Unsaved changes</span>}
            </div>
            {!name.trim() && <p className="text-caption text-ink-500">Give the sequence a name to save it.</p>}
          </section>
        </div>

        <aside className={cn("lg:sticky lg:top-6", tab === "edit" && "hidden lg:block")} aria-label="Preview">
          <div className="mb-3 flex items-center gap-2 text-small font-semibold text-ink-800">
            <Eye className="size-4" aria-hidden />
            {current ? `Email ${focus + 1}, as ${SAMPLE.first_name} sees it` : "Preview"}
          </div>
          {current ? (
            <>
              <p className="mb-3 truncate rounded-field bg-paper-100 px-4 py-3 text-small text-ink-800">
                <span className="font-semibold">{subjectPreview || "No subject yet"}</span>
              </p>
              <iframe title="Preview of the email" sandbox="" srcDoc={preview} className="h-[640px] w-full rounded-bubble border border-hairline bg-paper-0" />
            </>
          ) : (
            <p className="rounded-field bg-paper-100 p-4 text-small text-ink-500">Add an email to see it here.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
