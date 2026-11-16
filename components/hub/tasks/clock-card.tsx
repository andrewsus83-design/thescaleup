"use client";

import { useActionState } from "react";
import { Loader2, LogIn, LogOut } from "lucide-react";
import { Alert, Btn, Card } from "@/components/brand/primitives";
import type { FormState } from "@/lib/hub/actions";
import { clockIn, clockOut } from "@/lib/hub/clock-actions";

/** One button that is either "Clock in" or "Clock out", whichever applies. `sinceLabel` is already formatted in the brand's time zone. */
export function ClockCard({ brandId, sinceLabel }: { brandId: string; sinceLabel: string | null }) {
  const [inState, inAction, inPending] = useActionState<FormState, FormData>(clockIn, {});
  const [outState, outAction, outPending] = useActionState<FormState, FormData>(clockOut, {});
  const running = sinceLabel !== null;
  const state = running ? outState : inState;
  return (
    <Card small>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-body font-semibold text-ink-800">{running ? "You are clocked in" : "You are clocked out"}</p>
          <p className="text-small text-ink-500">{running ? `Since ${sinceLabel}` : "Clock in when you start working."}</p>
        </div>
        <form action={running ? outAction : inAction}>
          <input type="hidden" name="brandId" value={brandId} />
          <Btn type="submit" variant={running ? "dark" : "primary"} disabled={inPending || outPending}>
            {inPending || outPending ? <Loader2 className="size-4 animate-spin" aria-label="Working" /> : running ? <LogOut className="size-4" aria-hidden /> : <LogIn className="size-4" aria-hidden />}
            {running ? "Clock out" : "Clock in"}
          </Btn>
        </form>
      </div>
      {state.error && (
        <div className="mt-4">
          <Alert tone="bad" role="alert">
            {state.error}
          </Alert>
        </div>
      )}
    </Card>
  );
}
