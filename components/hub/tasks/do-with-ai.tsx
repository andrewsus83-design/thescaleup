"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";
import { Alert, Btn, Card } from "@/components/brand/primitives";
import { labelCls, textareaCls } from "@/components/brand/styles";
import { addDraftToWiki, doWithAi, saveAiDraft, type DoRead } from "@/lib/hub/task-do-actions";
import { DO_LIMITS, JOBS, JOB_LIST, isJob, type Flags, type JobId, type Turn } from "@/lib/hub/tasks/do-ai";
import { TYPES, TYPE_INFO, type PageType } from "@/lib/hub/wiki/model";
import { cn } from "@/lib/utils";
import { compactField } from "./parts";

type Note = { tone: "ok" | "bad"; text: string; href?: string } | null;
type Latest = { read: DoRead; flags: Flags; truncated: boolean } | null;

/**
 * "Do with AI" on a task. One press gives a draft; a small box under it changes the draft. The chat lives only in this component:
 * closing it, or leaving the page, throws it away. Only "Save to task" and "Add to Wiki" keep anything, and only when pressed.
 */
export function DoWithAi({ brandId, taskId, taskTitle, slug, startJob, canWiki }: { brandId: string; taskId: string; taskTitle: string; slug: string; startJob: JobId; canWiki: boolean }) {
  const [job, setJob] = useState<JobId>(startJob);
  const [paste, setPaste] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]); // the AI's draft, then the person's change request, the next draft, ...
  const [ask, setAsk] = useState("");
  const [latest, setLatest] = useState<Latest>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [wikiOpen, setWikiOpen] = useState(false);
  const [wikiTitle, setWikiTitle] = useState(taskTitle.slice(0, 120));
  const [wikiType, setWikiType] = useState<PageType>(JOBS[startJob].wikiType);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const draftRef = useRef<HTMLDivElement>(null);

  const def = JOBS[job];
  const draft = turns.length ? turns[turns.length - 1].text : null;
  const unsaved = draft !== null && saved !== draft;
  const chatFull = turns.length + 1 > DO_LIMITS.turns;

  // A draft that is not saved is lost when the page closes. Say so before it happens.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  function run(request: Turn[], next: Turn[]) {
    setNote(null);
    start(async () => {
      const r = await doWithAi({ brandId, taskId, job, ask: def.needsText ? paste : "", turns: request });
      if (!r.ok) {
        setNote({ tone: "bad", text: r.error });
        return;
      }
      setTurns([...next, { role: "assistant", text: r.text }]);
      setLatest({ read: r.read, flags: r.flags, truncated: r.truncated });
      if (request.length) setAsk("");
      setConfirmClose(false);
      requestAnimationFrame(() => draftRef.current?.focus());
    });
  }

  const begin = () => run([], []);
  const change = () => {
    const text = ask.trim();
    if (!text || !draft) return;
    const request: Turn[] = [...turns, { role: "user", text }];
    run(request, request);
  };

  function close() {
    setTurns([]);
    setLatest(null);
    setSaved(null);
    setAsk("");
    setPaste("");
    setNote(null);
    setConfirmClose(false);
    setWikiOpen(false);
  }

  function save() {
    if (!draft) return;
    const text = draft;
    setNote(null);
    start(async () => {
      const r = await saveAiDraft({ brandId, taskId, text });
      if (r.ok) setSaved(text);
      setNote(r.ok ? { tone: "ok", text: r.message } : { tone: "bad", text: r.error });
    });
  }

  function addWiki() {
    if (!draft) return;
    setNote(null);
    start(async () => {
      const r = await addDraftToWiki({ brandId, taskId, title: wikiTitle, type: wikiType, text: draft });
      if (r.ok) setWikiOpen(false);
      setNote(r.ok ? { tone: "ok", text: r.message, href: r.href } : { tone: "bad", text: r.error });
    });
  }

  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNote({ tone: "bad", text: "Your browser would not copy it. Select the text and copy it by hand." });
    }
  }

  return (
    <Card small>
      <div className="space-y-5">
        <div>
          <p className="text-small text-ink-500">AI writes a first draft from the brand profile, the Wiki and this task. You check it, change it by asking, and save what you want to keep. The chat is not stored.</p>
        </div>

        {!draft && (
          <div className="space-y-4">
            <label className="block">
              <span className={labelCls}>What kind of help</span>
              <select
                value={job}
                onChange={(e) => {
                  if (isJob(e.target.value)) {
                    setJob(e.target.value);
                    setWikiType(JOBS[e.target.value].wikiType);
                  }
                }}
                className={cn(compactField, "w-full sm:w-auto sm:min-w-72")}
              >
                {JOB_LIST.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.label}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-caption text-ink-500">{def.hint}</span>
            </label>
            {def.needsText && (
              <label className="block">
                <span className={labelCls}>Text to check</span>
                <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={6} maxLength={DO_LIMITS.paste} className={textareaCls} placeholder="Paste the post, message or page text here." />
              </label>
            )}
            <Btn variant="primary" onClick={begin} disabled={pending || (def.needsText && paste.trim().length < 10)}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
              {pending ? "Working…" : def.start}
            </Btn>
          </div>
        )}

        <div aria-live="polite" className="space-y-4">
          {note && (
            <Alert tone={note.tone} role={note.tone === "bad" ? "alert" : "status"}>
              {note.text}
              {note.href && (
                <>
                  {" "}
                  <Link href={note.href} className="font-semibold underline underline-offset-2">
                    Open the page
                  </Link>
                </>
              )}
            </Alert>
          )}

          {draft && latest && (
            <>
              <ol className="space-y-3">
                {turns.slice(0, -1).map((t, n) =>
                  t.role === "user" ? (
                    <li key={n} className="text-small text-ink-500">
                      <span className="font-semibold text-ink-800">You asked:</span> {t.text}
                    </li>
                  ) : (
                    <li key={n}>
                      <details className="rounded-field border-control border-ink-200 p-3">
                        <summary className="min-h-8 cursor-pointer text-small font-semibold text-ink-800">Earlier draft</summary>
                        <p className="mt-2 whitespace-pre-wrap break-words text-small text-ink-800">{t.text}</p>
                      </details>
                    </li>
                  ),
                )}
              </ol>

              <div ref={draftRef} tabIndex={-1} className="whitespace-pre-wrap break-words rounded-field bg-paper-0 p-4 text-body text-ink-800 outline-none focus-visible:shadow-focus">
                {draft}
              </div>

              {latest.truncated && <Alert tone="warn">The reply was cut off at the length limit. Ask it to shorten the draft or to do it in two parts.</Alert>}
              {latest.flags.placeholders > 0 && (
                <Alert tone="warn">
                  {latest.flags.placeholders} {latest.flags.placeholders === 1 ? "gap" : "gaps"} in square brackets still need a real fact before this is used.
                </Alert>
              )}
              {latest.flags.wording.length > 0 && (
                <Alert tone="warn">Check this wording: it can read as a promise. {latest.flags.wording.map((w) => `“${w}”`).join(", ")}.</Alert>
              )}
              <p className="text-caption text-ink-500">
                Read: {latest.read.profile ? `brand profile (${latest.read.profile} of ${latest.read.profileTotal} answered)` : "no brand profile"}, {latest.read.wiki} Wiki {latest.read.wiki === 1 ? "page" : "pages"}, {latest.read.steps} {latest.read.steps === 1 ? "step" : "steps"}, {latest.read.comments}{" "}
                {latest.read.comments === 1 ? "comment" : "comments"}.{" "}
                {latest.read.profile === 0 && (
                  <>
                    The draft is generic until the profile is filled in:{" "}
                    <Link href={`/hub/b/${slug}/brand/profile`} className="underline underline-offset-2">
                      open the brand profile
                    </Link>
                    .
                  </>
                )}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Btn variant="primary" onClick={save} disabled={pending || saved === draft}>
                  {saved === draft ? "Saved to task" : "Save to task"}
                </Btn>
                <Btn onClick={copy}>
                  {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                  {copied ? "Copied" : "Copy"}
                </Btn>
                {canWiki && (
                  <Btn variant="secondary" onClick={() => setWikiOpen((o) => !o)} aria-expanded={wikiOpen}>
                    Add to Wiki
                  </Btn>
                )}
                <Btn variant="ghost" onClick={() => (unsaved ? setConfirmClose(true) : close())}>
                  Close chat
                </Btn>
              </div>

              {confirmClose && (
                <Alert tone="warn" role="alert">
                  <p>This draft is not saved. Closing the chat throws it away.</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Btn variant="danger" size="sm" onClick={close}>
                      Close and discard
                    </Btn>
                    <Btn size="sm" onClick={() => setConfirmClose(false)}>
                      Keep working
                    </Btn>
                  </div>
                </Alert>
              )}

              {wikiOpen && (
                <div className="space-y-4 rounded-field border-control border-ink-200 p-4">
                  <p className="text-small text-ink-500">The Wiki is what AI reads later as fact. Add only what you have checked.</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className={labelCls}>Page title</span>
                      <input value={wikiTitle} onChange={(e) => setWikiTitle(e.target.value)} maxLength={120} className={cn(compactField, "w-full")} />
                    </label>
                    <label className="block">
                      <span className={labelCls}>Type</span>
                      <select value={wikiType} onChange={(e) => setWikiType(e.target.value as PageType)} className={cn(compactField, "w-full")}>
                        {TYPES.map((t) => (
                          <option key={t} value={t}>
                            {TYPE_INFO[t].label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <Btn variant="primary" onClick={addWiki} disabled={pending || !wikiTitle.trim()}>
                    {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    Add page
                  </Btn>
                </div>
              )}

              <div className="space-y-3">
                <label className="block">
                  <span className={labelCls}>Ask for a change</span>
                  <textarea
                    value={ask}
                    onChange={(e) => setAsk(e.target.value)}
                    rows={3}
                    maxLength={DO_LIMITS.ask}
                    disabled={chatFull}
                    className={textareaCls}
                    placeholder="Shorter. Add the price. Make it warmer. Use Bahasa Indonesia."
                  />
                </label>
                {chatFull ? (
                  <p className="text-caption text-ink-500">This chat is long. Save what you need, close it and start a new one.</p>
                ) : (
                  <Btn onClick={change} disabled={pending || !ask.trim()}>
                    {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    {pending ? "Working…" : "Send"}
                  </Btn>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
