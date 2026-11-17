"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { protectBatch } from "@/lib/hub/crm-protect-actions";
import { fmtNum } from "@/lib/hub/products/model";

const START = "00000000-0000-0000-0000-000000000000";

/** Runs the batches one after another and shows the running total. It can be stopped by leaving the page and started again later. */
export function ProtectRunner({ brandId, left }: { brandId: string; left: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState({ people: 0, notes: 0 });
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);

  async function run() {
    setBusy(true);
    setError("");
    setFinished(false);
    let afterPeople = START;
    let afterNotes = START;
    let people = 0;
    let notes = 0;
    try {
      for (;;) {
        const r = await protectBatch({ brandId, afterPeople, afterNotes });
        if (!r.ok) {
          setError(r.error);
          break;
        }
        if (r.done) {
          setFinished(true);
          break;
        }
        people += r.people;
        notes += r.notes;
        afterPeople = r.afterPeople;
        afterNotes = r.afterNotes;
        setDone({ people, notes });
      }
    } catch {
      setError("The connection dropped. Press the button again to carry on; what was done is kept.");
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert tone="bad" role="alert">
          {error}
        </Alert>
      )}
      {finished && (
        <Alert tone="ok" role="status">
          Done. {fmtNum(done.notes)} notes and {fmtNum(done.people)} summaries are now stored wrapped.
        </Alert>
      )}
      <Btn type="button" variant="primary" onClick={run} disabled={busy || left === 0}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {busy ? `Protecting… ${fmtNum(done.notes + done.people)} done` : "Protect what is already saved"}
      </Btn>
    </div>
  );
}
