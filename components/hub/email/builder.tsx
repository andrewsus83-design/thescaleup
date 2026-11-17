"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, Loader2, Plus, Send, Trash2, Users } from "lucide-react";
import { Alert, Btn, Card } from "@/components/brand/primitives";
import { inputCls, labelCls, pillCls, segItem, segWrap, textareaCls } from "@/components/brand/styles";
import { compactField } from "@/components/hub/tasks/parts";
import { loadTemplateDoc, previewAudience, saveAsTemplate, saveCampaign, sendTest, startCampaign } from "@/lib/hub/email-actions";
import { AUDIENCE_KINDS, BLOCK_LABEL, BLOCK_TYPES, EMAIL_LIMITS, MERGE_TAGS, STARTERS, docProblems, merge, newBlock, renderEmail, type Audience, type Block, type BlockType, type Doc } from "@/lib/hub/email/model";
import { cn } from "@/lib/utils";
import { SendRunner } from "./runner";

type Counted = { count: number; matched: number; skips: { noEmail: number; invalid: number; duplicate: number; suppressed: number; overLimit: number } };
type Props = {
  brandId: string;
  slug: string;
  brandName: string;
  id?: string;
  initial: { name: string; doc: Doc; addressId: string; audience: Audience };
  addresses: { id: string; email: string; name: string }[];
  templates: { id: string; name: string }[];
  stages: { lead: string[]; client: string[] };
  /** What is missing on the server for sending, in words. Empty when sending works. */
  blocker: string;
};

const SAMPLE = { first_name: "Rina", name: "Rina Wijaya", company: "Maju Jaya" };
const KIND_LABEL = { lead: "Leads", client: "Clients" } as const;

function Skips({ c }: { c: Counted }) {
  const s = c.skips;
  const parts = [s.suppressed && `${s.suppressed} unsubscribed or bounced`, s.noEmail && `${s.noEmail} without an email`, s.invalid && `${s.invalid} with an email that does not look right`, s.duplicate && `${s.duplicate} duplicates`, s.overLimit && `${s.overLimit} over the limit of ${EMAIL_LIMITS.recipients} per campaign`].filter(Boolean);
  return parts.length ? <span className="text-ink-500"> Left out: {parts.join(", ")}.</span> : null;
}

export function CampaignBuilder({ brandId, slug, brandName, id: id0, initial, addresses, templates, stages, blocker }: Props) {
  const router = useRouter();
  const uid = useId();
  const [id, setId] = useState(id0);
  const [name, setName] = useState(initial.name);
  const [doc, setDoc] = useState<Doc>(initial.doc);
  const [addressId, setAddressId] = useState(initial.addressId);
  const [audience, setAudience] = useState<Audience>(initial.audience);
  const [dirty, setDirty] = useState(false);
  const [counted, setCounted] = useState<Counted | null>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [tplName, setTplName] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState<{ total: number } | null>(null);
  const [finished, setFinished] = useState(false);

  const problems = useMemo(() => docProblems(doc), [doc]);
  const preview = useMemo(() => renderEmail(doc, { ...SAMPLE, brand: brandName }, "https://example.com/unsubscribe").html, [doc, brandName]);
  const subjectPreview = merge(doc.subject, { ...SAMPLE, brand: brandName });
  const stageList = useMemo(() => [...new Set([...(audience.kinds.includes("lead") ? stages.lead : []), ...(audience.kinds.includes("client") ? stages.client : [])])], [audience.kinds, stages]);

  const change = (fn: (d: Doc) => Doc) => {
    setDoc(fn);
    setDirty(true);
    setMsg(null);
  };
  const setBlock = (i: number, patch: Record<string, string>) => change((d) => ({ ...d, blocks: d.blocks.map((b, k) => (k === i ? ({ ...b, ...patch } as Block) : b)) }));
  const move = (i: number, by: -1 | 1) =>
    change((d) => {
      const j = i + by;
      if (j < 0 || j >= d.blocks.length) return d;
      const blocks = [...d.blocks];
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...d, blocks };
    });
  const addBlock = (t: BlockType) => change((d) => (d.blocks.length >= EMAIL_LIMITS.blocks ? d : { ...d, blocks: [...d.blocks, newBlock(t)] }));
  const setAud = (a: Audience) => {
    setAudience(a);
    setCounted(null);
    setDirty(true);
  };

  /** Saves, creating the campaign the first time. Returns its id, or null when it could not be saved (the message says why). */
  async function save(): Promise<string | null> {
    const r = await saveCampaign({ brandId, id, name, doc, addressId, audience });
    if (!r.ok) {
      setMsg({ tone: "bad", text: r.error });
      return null;
    }
    setDirty(false);
    if (!id) {
      setId(r.id);
      router.replace(`/hub/b/${slug}/mail/campaigns/${r.id}`);
    }
    return r.id;
  }

  const onSave = () =>
    start(async () => {
      const got = await save();
      if (got) setMsg({ tone: "ok", text: "Saved as a draft." });
    });
  const onTest = () =>
    start(async () => {
      const got = await save();
      if (!got) return;
      const r = await sendTest(brandId, got);
      setMsg(r.ok ? { tone: "ok", text: `A test went to ${r.to}. Check your inbox and spam.` } : { tone: "bad", text: r.error });
    });
  const onCount = () =>
    start(async () => {
      const r = await previewAudience(brandId, audience);
      if (r.ok) setCounted({ count: r.count, matched: r.matched, skips: r.skips });
      else setMsg({ tone: "bad", text: r.error });
    });
  const onSend = () =>
    start(async () => {
      const got = await save();
      if (!got) return;
      const r = await startCampaign(brandId, got, consent);
      if (r.ok) {
        setSending({ total: r.total });
        setConfirming(false);
      } else setMsg({ tone: "bad", text: r.error });
    });
  const onTemplate = () =>
    start(async () => {
      const r = await saveAsTemplate({ brandId, name: tplName ?? "", doc });
      if (r.ok) {
        setTplName(null);
        setMsg({ tone: "ok", text: "Saved as a template. It shows up under “Start from” in new campaigns." });
        router.refresh();
      } else setMsg({ tone: "bad", text: r.error });
    });
  const applyDoc = (d: Doc) => {
    change(() => ({ ...d }));
    setTab("edit");
  };
  const applyTemplate = (tid: string) =>
    start(async () => {
      const r = await loadTemplateDoc(brandId, tid);
      if (r.ok) applyDoc(r.doc);
      else setMsg({ tone: "bad", text: r.error });
    });

  if (sending) {
    return (
      <Card className="mx-auto max-w-xl">
        <h2 className="font-title text-h3 text-ink-800">{finished ? "Campaign sent" : "Sending your campaign"}</h2>
        <p className="mb-6 mt-2 text-small text-ink-500">{name}</p>
        <SendRunner brandId={brandId} slug={slug} id={id as string} total={sending.total} sent={0} failed={0} autoStart onDone={() => setFinished(true)} />
        {finished && (
          <Btn variant="secondary" className="mt-6" onClick={() => router.push(`/hub/b/${slug}/mail/campaigns`)}>
            Back to campaigns
          </Btn>
        )}
      </Card>
    );
  }

  const empty = doc.blocks.length === 0;
  const startFrom = (
    <div className="flex flex-wrap gap-2">
      {STARTERS.filter((s) => (empty ? true : s.id !== "blank")).map((s) => (
        <button key={s.id} type="button" onClick={() => applyDoc(s.doc)} className={pillCls(false)} title={s.hint}>
          {s.name}
        </button>
      ))}
      {templates.map((t) => (
        <button key={t.id} type="button" disabled={pending} onClick={() => applyTemplate(t.id)} className={pillCls(false)}>
          {t.name}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {blocker && <Alert tone="warn" title="Sending is not ready.">{blocker} You can still write and save drafts.</Alert>}
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
          <section aria-labelledby={`${uid}-start`} className="space-y-3">
            <h2 id={`${uid}-start`} className="text-small font-semibold text-ink-800">
              {empty ? "Start from" : "Start over from"}
            </h2>
            {!empty && <p className="text-caption text-ink-500">This replaces what is in the email now. The campaign name, sender and audience stay.</p>}
            {startFrom}
          </section>

          <section className="space-y-4" aria-label="Basics">
            <div>
              <label htmlFor={`${uid}-name`} className={labelCls}>
                Campaign name
              </label>
              <input id={`${uid}-name`} value={name} maxLength={EMAIL_LIMITS.name} onChange={(e) => {
                  setName(e.target.value);
                  setDirty(true);
                }} placeholder="March newsletter" className={inputCls} />
              <p className="mt-2 text-caption text-ink-500">Only your team sees this.</p>
            </div>
            <div>
              <label htmlFor={`${uid}-from`} className={labelCls}>
                Send from
              </label>
              <select id={`${uid}-from`} value={addressId} onChange={(e) => {
                  setAddressId(e.target.value);
                  setDirty(true);
                }} className={cn(inputCls, "appearance-auto")}>
                <option value="">Pick an address</option>
                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ? `${a.name} <${a.email}>` : a.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-subject`} className={labelCls}>
                Subject
              </label>
              <input id={`${uid}-subject`} value={doc.subject} maxLength={EMAIL_LIMITS.subject} onChange={(e) => change((d) => ({ ...d, subject: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label htmlFor={`${uid}-pre`} className={labelCls}>
                Preview line
              </label>
              <input id={`${uid}-pre`} value={doc.preheader} maxLength={EMAIL_LIMITS.preheader} onChange={(e) => change((d) => ({ ...d, preheader: e.target.value }))} className={inputCls} />
              <p className="mt-2 text-caption text-ink-500">The grey text next to the subject in most inboxes.</p>
            </div>
            <p className="text-caption text-ink-500">
              Personalise with {MERGE_TAGS.map((t) => `{{${t}}}`).join(", ")}. Add a fallback after a bar, like {"{{first_name|there}}"}, for people without a name.
            </p>
          </section>

          <section className="space-y-4" aria-label="Content">
            <h2 className="text-small font-semibold text-ink-800">Content</h2>
            {doc.blocks.length === 0 && <p className="rounded-field bg-paper-100 p-4 text-small text-ink-500">Nothing here yet. Pick a design above or add a block below.</p>}
            <ol className="space-y-3">
              {doc.blocks.map((b, i) => (
                <li key={i} className="rounded-bubble border border-hairline bg-paper-0 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-small font-semibold text-ink-800">{BLOCK_LABEL[b.type]}</span>
                    <span className="flex items-center gap-1">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move block ${i + 1} up`} className="hit-44 inline-flex size-11 items-center justify-center rounded-full text-ink-500 hover:bg-paper-100 disabled:opacity-30">
                        <ArrowUp className="size-4" aria-hidden />
                      </button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === doc.blocks.length - 1} aria-label={`Move block ${i + 1} down`} className="hit-44 inline-flex size-11 items-center justify-center rounded-full text-ink-500 hover:bg-paper-100 disabled:opacity-30">
                        <ArrowDown className="size-4" aria-hidden />
                      </button>
                      <button type="button" onClick={() => change((d) => ({ ...d, blocks: d.blocks.filter((_, k) => k !== i) }))} aria-label={`Delete block ${i + 1}`} className="hit-44 inline-flex size-11 items-center justify-center rounded-full text-ink-500 hover:bg-paper-100">
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </span>
                  </div>
                  {b.type === "heading" && <input aria-label="Heading" value={b.text} maxLength={EMAIL_LIMITS.heading} onChange={(e) => setBlock(i, { text: e.target.value })} className={cn(compactField, "w-full")} />}
                  {b.type === "text" && <textarea aria-label="Text" value={b.text} maxLength={EMAIL_LIMITS.text} rows={4} onChange={(e) => setBlock(i, { text: e.target.value })} className={textareaCls} />}
                  {b.type === "button" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input aria-label="Button label" placeholder="Button text" value={b.label} maxLength={EMAIL_LIMITS.label} onChange={(e) => setBlock(i, { label: e.target.value })} className={cn(compactField, "w-full")} />
                      <input aria-label="Button link" placeholder="https://…" inputMode="url" autoCapitalize="none" spellCheck={false} value={b.url} maxLength={EMAIL_LIMITS.url} onChange={(e) => setBlock(i, { url: e.target.value })} className={cn(compactField, "w-full")} />
                    </div>
                  )}
                  {b.type === "image" && (
                    <div className="space-y-3">
                      <input aria-label="Image link" placeholder="Link to the picture, https://…" inputMode="url" autoCapitalize="none" spellCheck={false} value={b.url} maxLength={EMAIL_LIMITS.url} onChange={(e) => setBlock(i, { url: e.target.value })} className={cn(compactField, "w-full")} />
                      <input aria-label="Describe the image" placeholder="Describe the picture in a few words" value={b.alt} maxLength={EMAIL_LIMITS.alt} onChange={(e) => setBlock(i, { alt: e.target.value })} className={cn(compactField, "w-full")} />
                      <input aria-label="Where the image links to (optional)" placeholder="Where it goes when clicked (optional)" inputMode="url" autoCapitalize="none" spellCheck={false} value={b.link} maxLength={EMAIL_LIMITS.url} onChange={(e) => setBlock(i, { link: e.target.value })} className={cn(compactField, "w-full")} />
                      <p className="text-caption text-ink-500">Use a public link to a picture that stays online. Uploading pictures here comes later.</p>
                    </div>
                  )}
                  {(b.type === "divider" || b.type === "spacer") && <p className="text-caption text-ink-500">{b.type === "divider" ? "A thin line between two parts." : "Empty space."}</p>}
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Add a block">
              {BLOCK_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => addBlock(t)} disabled={doc.blocks.length >= EMAIL_LIMITS.blocks} className={pillCls(false)}>
                  <Plus className="size-4" aria-hidden />
                  {BLOCK_LABEL[t]}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4" aria-label="Style and footer">
            <div className="flex items-center gap-4">
              <label htmlFor={`${uid}-accent`} className="text-small font-semibold text-ink-800">
                Accent colour
              </label>
              <input id={`${uid}-accent`} type="color" value={doc.accent} onChange={(e) => change((d) => ({ ...d, accent: e.target.value }))} className="size-11 cursor-pointer rounded-full border border-ink-200 bg-paper-0 p-1" />
              <span className="text-caption text-ink-500">Top line and buttons.</span>
            </div>
            <div>
              <label htmlFor={`${uid}-footer`} className={labelCls}>
                Footer: who sends this
              </label>
              <textarea id={`${uid}-footer`} value={doc.footer} maxLength={EMAIL_LIMITS.footer} rows={3} onChange={(e) => change((d) => ({ ...d, footer: e.target.value }))} className={textareaCls} />
              <p className="mt-2 text-caption text-ink-500">Your business name and postal address. The unsubscribe link is added for you.</p>
            </div>
          </section>

          <section className="space-y-4" aria-label="Who gets it">
            <h2 className="text-small font-semibold text-ink-800">Who gets it</h2>
            <div className="flex flex-wrap gap-2" role="group" aria-label="People">
              {AUDIENCE_KINDS.map((k) => {
                const on = audience.kinds.includes(k);
                return (
                  <button key={k} type="button" aria-pressed={on} onClick={() => setAud({ kinds: on ? audience.kinds.filter((x) => x !== k) : [...audience.kinds, k], stages: [] })} className={pillCls(on)}>
                    {KIND_LABEL[k]}
                  </button>
                );
              })}
            </div>
            {stageList.length > 0 && (
              <div>
                <p className="mb-2 text-caption text-ink-500">Only these stages. Pick none to include all.</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Stages">
                  {stageList.map((s) => {
                    const on = audience.stages.includes(s);
                    return (
                      <button key={s} type="button" aria-pressed={on} onClick={() => setAud({ ...audience, stages: on ? audience.stages.filter((x) => x !== s) : [...audience.stages, s] })} className={pillCls(on)}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Btn variant="secondary" size="sm" disabled={pending || audience.kinds.length === 0} onClick={onCount}>
                <Users className="size-4" aria-hidden />
                Count people
              </Btn>
              {counted && (
                <p className="text-small text-ink-800" role="status">
                  <strong>{counted.count}</strong> {counted.count === 1 ? "person gets" : "people get"} this.
                  <Skips c={counted} />
                </p>
              )}
            </div>
            <p className="text-caption text-ink-500">People who unsubscribed, or whose address bounced, are never included.</p>
          </section>

          <section className="space-y-4 border-t border-hairline pt-6" aria-label="Save and send">
            {problems.length > 0 && (
              <div className="rounded-field bg-paper-100 p-4">
                <p className="text-small font-semibold text-ink-800">Before you can send</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-small text-ink-800">
                  {problems.slice(0, 6).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                  {problems.length > 6 && <li>And {problems.length - 6} more.</li>}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Btn variant="secondary" disabled={pending || !name.trim()} onClick={onSave}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-label="Working" /> : null}
                Save draft
              </Btn>
              <Btn variant="secondary" disabled={pending || !name.trim() || !addressId || !!blocker} onClick={onTest}>
                Send a test to me
              </Btn>
              <Btn variant="ghost" disabled={pending || empty} onClick={() => setTplName(tplName === null ? name : null)}>
                Save as template
              </Btn>
              {dirty && <span className="hidden text-caption text-ink-500 lg:inline">Unsaved changes</span>}
            </div>
            {!name.trim() && <p className="text-caption text-ink-500">Give the campaign a name to save it.</p>}
            {tplName !== null && (
              <div className="flex flex-wrap items-center gap-3 rounded-field bg-paper-100 p-4">
                <input aria-label="Template name" value={tplName} maxLength={EMAIL_LIMITS.name} onChange={(e) => setTplName(e.target.value)} className={cn(compactField, "min-w-0 flex-1")} placeholder="Template name" />
                <Btn variant="primary" size="sm" disabled={pending || !tplName.trim()} onClick={onTemplate}>
                  Save template
                </Btn>
              </div>
            )}

            {!confirming ? (
              <Btn variant="primary" size="lg" disabled={pending || !!blocker || problems.length > 0 || !addressId || !name.trim() || !counted || counted.count === 0} onClick={() => setConfirming(true)}>
                <Send className="size-5" aria-hidden />
                Review and send
              </Btn>
            ) : (
              <div className="space-y-4 rounded-bubble border border-ink-200 bg-paper-0 p-5">
                <p className="text-small text-ink-800">
                  This sends “{subjectPreview}” to <strong>{counted?.count ?? 0}</strong> {counted?.count === 1 ? "person" : "people"}. Once it starts, it cannot be recalled.
                </p>
                <label className="flex items-start gap-3 text-small text-ink-800">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-ink-800" />
                  <span>Everyone on this list agreed to get email from {brandName}, or is a customer who expects it.</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  <Btn variant="primary" disabled={pending || !consent} onClick={onSend}>
                    {pending ? <Loader2 className="size-4 animate-spin" aria-label="Starting" /> : <Send className="size-4" aria-hidden />}
                    Send now
                  </Btn>
                  <Btn variant="ghost" onClick={() => setConfirming(false)}>
                    Not yet
                  </Btn>
                </div>
              </div>
            )}
            {!counted && !blocker && problems.length === 0 && <p className="text-caption text-ink-500">Count the people first, so you know how many will get it.</p>}
          </section>
        </div>

        <aside className={cn("lg:sticky lg:top-6", tab === "edit" && "hidden lg:block")} aria-label="Preview">
          <div className="mb-3 flex items-center gap-2 text-small font-semibold text-ink-800">
            <Eye className="size-4" aria-hidden />
            Preview, as {SAMPLE.first_name} sees it
          </div>
          <p className="mb-3 truncate rounded-field bg-paper-100 px-4 py-3 text-small text-ink-800">
            <span className="font-semibold">{subjectPreview || "No subject yet"}</span>
          </p>
          <iframe title="Preview of the email" sandbox="" srcDoc={preview} className="h-[640px] w-full rounded-bubble border border-hairline bg-paper-0" />
        </aside>
      </div>
    </div>
  );
}
