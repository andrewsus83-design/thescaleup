"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pause, Play, Send, Trash2, UserPlus } from "lucide-react";
import { Alert, Btn, Card, Chip, type Tone } from "@/components/brand/primitives";
import { countEnrollable, deleteSequence, enrollPeople, sendDueNow, setAutoEnroll, setSequenceStatus } from "@/lib/hub/sequence-actions";
import { SEQ_LIMITS, STOP_LABEL, STOP_REASONS, type SeqStatus, type StopReason } from "@/lib/hub/email/sequence-model";

type StepLine = { day: number; subject: string; sent: number; bounced: number; failed: number };
type Props = {
  brandId: string;
  slug: string;
  id: string;
  brandName: string;
  status: SeqStatus;
  canWrite: boolean;
  /** What stops it from starting, in words (no emails, no sender, no mail server key). Empty when it can start. */
  startBlocker: string;
  autoEnroll: boolean;
  /** When automatic adding was switched on, already formatted for the reader. */
  autoSince: string;
  counts: { active: number; due: number; done: number; stopped: number };
  reasons: Partial<Record<StopReason, number>>;
  lines: StepLine[];
};

const STATUS: Record<SeqStatus, { label: string; tone: Tone }> = { draft: { label: "Draft", tone: "neutral" }, active: { label: "Running", tone: "ok" }, paused: { label: "Paused", tone: "warn" } };
const people = (n: number) => `${n.toLocaleString("en")} ${n === 1 ? "person" : "people"}`;

export function SequenceControl({ brandId, slug, id, brandName, status, canWrite, startBlocker, autoEnroll, autoSince, counts, reasons, lines }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [adding, setAdding] = useState<{ count: number } | null>(null);
  const [turningOn, setTurningOn] = useState(false);
  const [consent, setConsent] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const run = (fn: () => Promise<void>) => start(fn);
  const changeStatus = (to: "active" | "paused") =>
    run(async () => {
      const r = await setSequenceStatus(brandId, id, to);
      if (r.ok) {
        setMsg({ tone: "ok", text: to === "paused" ? "Paused. Nobody gets an email until you resume." : "Running. Add people to get it going." });
        router.refresh();
      } else setMsg({ tone: "bad", text: r.error });
    });
  const startAdding = () =>
    run(async () => {
      setMsg(null);
      const r = await countEnrollable(brandId, id);
      if (r.ok) {
        setAdding({ count: r.count });
        setConsent(false);
      } else setMsg({ tone: "bad", text: r.error });
    });
  const confirmAdd = () =>
    run(async () => {
      const r = await enrollPeople(brandId, id, consent);
      if (r.ok) {
        setAdding(null);
        const more = r.matching > r.added ? ` ${people(r.matching - r.added)} more can join. Add again for the rest.` : "";
        setMsg({ tone: "ok", text: r.added === 0 ? "Nobody new to add." : `${people(r.added)} added. Their first email goes out in the next run.${more}` });
        router.refresh();
      } else setMsg({ tone: "bad", text: r.error });
    });
  const toggleAuto = (on: boolean) =>
    run(async () => {
      const r = await setAutoEnroll(brandId, id, on, consent);
      if (r.ok) {
        setTurningOn(false);
        setConsent(false);
        setMsg({ tone: "ok", text: on ? "Automatic adding is on." : "Automatic adding is off." });
        router.refresh();
      } else setMsg({ tone: "bad", text: r.error });
    });
  const sendNow = () =>
    run(async () => {
      setMsg(null);
      const r = await sendDueNow(brandId, id);
      if (r.ok) {
        const bits = [`${r.sent} sent`, r.stopped ? `${r.stopped} left the sequence` : "", r.failed ? `${r.failed} could not be sent` : "", r.enrolled ? `${people(r.enrolled)} added automatically` : ""].filter(Boolean);
        setMsg({ tone: r.retry ? "bad" : "ok", text: r.retry ? `Resend is busy, so it stopped early (${bits.join(", ")}). Try again in a few minutes.` : `${bits.join(", ")}.` });
        router.refresh();
      } else setMsg({ tone: "bad", text: r.error });
    });
  const remove = () =>
    run(async () => {
      const r = await deleteSequence(brandId, id);
      if (r.ok) router.push(`/hub/b/${slug}/mail/sequences`);
      else {
        setMsg({ tone: "bad", text: r.error });
        setDeleting(false);
      }
    });

  const total = counts.active + counts.done + counts.stopped;
  const left = STOP_REASONS.filter((r) => r !== "completed" && reasons[r]).map((r) => `${reasons[r]} ${STOP_LABEL[r].toLowerCase()}`);
  const busy = pending ? <Loader2 className="size-4 animate-spin" aria-label="Working" /> : null;

  return (
    <div className="space-y-6">
      {msg && (
        <Alert tone={msg.tone} role={msg.tone === "bad" ? "alert" : "status"}>
          {msg.text}
        </Alert>
      )}

      <Card small>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Chip tone={STATUS[status].tone}>{STATUS[status].label}</Chip>
            <span className="text-small text-ink-500">{status === "draft" ? "Nobody gets an email until you start it." : status === "paused" ? "Nobody gets an email while it is paused." : `${people(counts.active)} in it now.`}</span>
          </div>
          {canWrite && (
            <div className="flex flex-wrap items-center gap-3">
              {status === "draft" && (
                <Btn variant="primary" disabled={pending || !!startBlocker} onClick={() => changeStatus("active")}>
                  {busy ?? <Play className="size-4" aria-hidden />}
                  Start the sequence
                </Btn>
              )}
              {status === "active" && (
                <Btn variant="secondary" disabled={pending} onClick={() => changeStatus("paused")}>
                  {busy ?? <Pause className="size-4" aria-hidden />}
                  Pause
                </Btn>
              )}
              {status === "paused" && (
                <Btn variant="primary" disabled={pending} onClick={() => changeStatus("active")}>
                  {busy ?? <Play className="size-4" aria-hidden />}
                  Resume
                </Btn>
              )}
            </div>
          )}
        </div>
        {status === "draft" && startBlocker && <p className="mt-3 text-caption text-ink-500">{startBlocker}</p>}
        {status === "paused" && counts.due > 0 && <p className="mt-3 text-caption text-ink-500">{people(counts.due)} became due while it was paused. They get their email in the next run after you resume.</p>}
      </Card>

      {status !== "draft" && (
        <Card small>
          <dl className="grid grid-cols-2 gap-4 text-small sm:grid-cols-4">
            {(
              [
                ["In it now", counts.active],
                ["Due today", counts.due],
                ["Got every email", counts.done],
                ["Left early", counts.stopped],
              ] as const
            ).map(([label, n]) => (
              <div key={label}>
                <dt className="text-ink-500">{label}</dt>
                <dd className="font-title text-h3 text-ink-800">{n.toLocaleString("en")}</dd>
              </div>
            ))}
          </dl>
          {left.length > 0 && <p className="mt-4 text-caption text-ink-500">Left early: {left.join(", ")}.</p>}
          {total === 0 && <p className="mt-4 text-caption text-ink-500">Nobody has joined yet.</p>}
        </Card>
      )}

      {canWrite && status === "active" && (
        <Card small>
          <h2 className="mb-1 text-small font-semibold text-ink-800">Who is in it</h2>
          <p className="mb-4 text-caption text-ink-500">Emails go out in the morning run, once a day. {counts.due > 0 ? `${people(counts.due)} are due today.` : "Nobody is due today."}</p>
          <div className="flex flex-wrap gap-3">
            <Btn variant="secondary" disabled={pending} onClick={startAdding}>
              {busy ?? <UserPlus className="size-4" aria-hidden />}
              Add people who match
            </Btn>
            <Btn variant="secondary" disabled={pending || counts.due === 0} onClick={sendNow}>
              {busy ?? <Send className="size-4" aria-hidden />}
              Send what is due now
            </Btn>
          </div>

          {adding && (
            <div className="mt-4 space-y-4 rounded-bubble border border-ink-200 bg-paper-0 p-5">
              {adding.count === 0 ? (
                <>
                  <p className="text-small text-ink-800">Nobody new matches. People already in it, who unsubscribed, bounced, or have no valid email are left out.</p>
                  <Btn variant="ghost" onClick={() => setAdding(null)}>
                    Close
                  </Btn>
                </>
              ) : (
                <>
                  <p className="text-small text-ink-800">
                    <strong>{people(adding.count)}</strong> can join. {adding.count > SEQ_LIMITS.enroll ? `This adds the first ${SEQ_LIMITS.enroll.toLocaleString("en")}; press the button again for the rest. ` : ""}
                    Their first email is sent in the next run.
                  </p>
                  <label className="flex items-start gap-3 text-small text-ink-800">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-ink-800" />
                    <span>Everyone on this list agreed to get email from {brandName}, or is a customer who expects it.</span>
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <Btn variant="primary" disabled={pending || !consent} onClick={confirmAdd}>
                      {busy}
                      Add {people(Math.min(adding.count, SEQ_LIMITS.enroll))}
                    </Btn>
                    <Btn variant="ghost" onClick={() => setAdding(null)}>
                      Not yet
                    </Btn>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="mt-6 border-t border-hairline pt-4">
            <h3 className="text-small font-semibold text-ink-800">Add new people automatically</h3>
            <p className="mt-1 text-caption text-ink-500">Once a day, people who join the CRM after you switch this on, and match who joins, are added. People who are already in the CRM are not added this way.</p>
            {autoEnroll ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Chip tone="ok">On since {autoSince}</Chip>
                <Btn variant="ghost" size="sm" disabled={pending} onClick={() => toggleAuto(false)}>
                  Switch off
                </Btn>
              </div>
            ) : turningOn ? (
              <div className="mt-3 space-y-4 rounded-bubble border border-ink-200 bg-paper-0 p-5">
                <label className="flex items-start gap-3 text-small text-ink-800">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-ink-800" />
                  <span>Everyone who joins this way agreed to get email from {brandName}, or is a customer who expects it.</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  <Btn variant="primary" disabled={pending || !consent} onClick={() => toggleAuto(true)}>
                    {busy}
                    Switch on
                  </Btn>
                  <Btn variant="ghost" onClick={() => setTurningOn(false)}>
                    Not yet
                  </Btn>
                </div>
              </div>
            ) : (
              <Btn variant="secondary" size="sm" className="mt-3" disabled={pending} onClick={() => { setConsent(false); setTurningOn(true); }}>
                Switch on
              </Btn>
            )}
          </div>
        </Card>
      )}

      {lines.length > 0 && status !== "draft" && (
        <Card small>
          <h2 className="mb-3 text-small font-semibold text-ink-800">How each email did</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-md text-left text-small">
              <thead>
                <tr className="text-caption text-ink-500">
                  <th scope="col" className="pb-2 pr-3 font-semibold">Email</th>
                  <th scope="col" className="pb-2 pr-3 font-semibold">Goes out</th>
                  <th scope="col" className="pb-2 pr-3 text-right font-semibold">Sent</th>
                  <th scope="col" className="pb-2 pr-3 text-right font-semibold">Bounced</th>
                  <th scope="col" className="pb-2 text-right font-semibold">Failed</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-t border-hairline text-ink-800">
                    <td className="max-w-64 truncate py-2 pr-3">{i + 1}. {l.subject || "No subject"}</td>
                    <td className="py-2 pr-3 text-ink-500">Day {l.day}</td>
                    <td className="py-2 pr-3 text-right">{l.sent}</td>
                    <td className="py-2 pr-3 text-right">{l.bounced}</td>
                    <td className="py-2 text-right">{l.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-caption text-ink-500">Opens and clicks are not tracked yet.</p>
        </Card>
      )}

      {canWrite && (
        <div>
          {!deleting ? (
            <Btn variant="ghost" onClick={() => setDeleting(true)}>
              <Trash2 className="size-4" aria-hidden />
              Delete this sequence
            </Btn>
          ) : (
            <span className="flex flex-wrap items-center gap-3 rounded-field bg-paper-100 px-4 py-2 text-small text-ink-800">
              Delete it, its people and its send log? Nobody gets another email from it.
              <Btn variant="danger" size="sm" disabled={pending} onClick={remove}>
                Yes, delete
              </Btn>
              <Btn variant="ghost" size="sm" onClick={() => setDeleting(false)}>
                Keep it
              </Btn>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
