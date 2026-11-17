"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { Alert, Bar, Btn } from "@/components/brand/primitives";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Step = { ok?: boolean; retry?: boolean; error?: string; note?: string; queued?: number; sent?: number; failed?: number; done?: boolean };

/**
 * Sends a started campaign, one small batch at a time, and shows how far it got. Close the page and nothing is lost: what is left stays
 * queued, and opening the campaign again continues from there. A batch Resend already took is never sent twice.
 */
export function SendRunner({ brandId, slug, id, total, sent: sent0, failed: failed0, autoStart, onDone }: { brandId: string; slug: string; id: string; total: number; sent: number; failed: number; autoStart?: boolean; onDone?: () => void }) {
  const [sent, setSent] = useState(sent0);
  const [failed, setFailed] = useState(failed0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const stop = useRef(false);
  const busy = useRef(false);

  async function run() {
    if (busy.current) return;
    busy.current = true;
    stop.current = false;
    setRunning(true);
    setError("");
    let misses = 0;
    while (!stop.current) {
      let j: Step | null = null;
      try {
        const r = await fetch(`/hub/b/${slug}/mail/campaigns/${id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brandId }) });
        j = (await r.json().catch(() => null)) as Step | null;
      } catch {
        j = null;
      }
      if (!j || j.retry) {
        misses++;
        if (misses > 6) {
          setError(j?.error ?? "Could not reach the server. Check your connection, then continue.");
          break;
        }
        await sleep(2500 * misses);
        continue;
      }
      if (!j.ok) {
        setError(j.error ?? "Something went wrong. Continue to try again.");
        break;
      }
      misses = 0;
      setSent(j.sent ?? 0);
      setFailed(j.failed ?? 0);
      if (j.note) setNote(j.note);
      if (j.done) {
        setDone(true);
        onDone?.();
        break;
      }
      await sleep(600);
    }
    busy.current = false;
    setRunning(false);
  }

  useEffect(() => {
    stop.current = false;
    // Deferred one tick: React runs effects twice in development, and the first run is cancelled here before it sends anything.
    const t = autoStart ? setTimeout(() => void run(), 0) : undefined;
    return () => {
      if (t) clearTimeout(t);
      stop.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- starts once when the page opens
  }, []);

  const left = Math.max(0, total - sent - failed);
  return (
    <div className="space-y-4" aria-live="polite">
      <Bar value={sent + failed} max={Math.max(total, 1)} label="Emails sent" tone={failed ? "warn" : "brand"} />
      <p className="text-small text-ink-800">
        {done ? "Finished. " : running ? "Sending. " : "Paused. "}
        {sent} of {total} sent{failed ? `, ${failed} could not be sent` : ""}
        {!done && left > 0 ? `, ${left} to go` : ""}.
      </p>
      {running && <p className="text-caption text-ink-500">Keep this page open. If you close it, open the campaign again to continue.</p>}
      {note && <Alert tone="warn">{note}</Alert>}
      {error && (
        <Alert tone="bad" role="alert">
          {error}
        </Alert>
      )}
      {!done && (
        <div className="flex gap-3">
          {running ? (
            <Btn variant="secondary" onClick={() => (stop.current = true)}>
              <Pause className="size-4" aria-hidden />
              Pause
            </Btn>
          ) : (
            <Btn variant="primary" onClick={() => void run()}>
              <Play className="size-4" aria-hidden />
              Continue sending
            </Btn>
          )}
          {running && <Loader2 className="size-5 animate-spin self-center text-ink-500" aria-label="Sending" />}
        </div>
      )}
    </div>
  );
}
