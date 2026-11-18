"use client";

import { useActionState } from "react";
import { Loader2, LogIn, LogOut } from "lucide-react";
import { Alert, Btn, Card, Chip } from "@/components/brand/primitives";
import type { FormState } from "@/lib/hub/actions";
import { clockIn, clockOut } from "@/lib/hub/clock-actions";

/** One button that is either "Clock in" or "Clock out", whichever applies. `sinceLabel` is already formatted in the brand's time zone. */
export function ClockCard({ brandId, sinceLabel, ink }: { brandId: string; sinceLabel: string | null; /** The dark panel, for the side column of a page. */ ink?: boolean }) {
  const [inState, inAction, inPending] = useActionState<FormState, FormData>(clockIn, {});
  const [outState, outAction, outPending] = useActionState<FormState, FormData>(clockOut, {});
  const running = sinceLabel !== null;
  const state = running ? outState : inState;
  const busy = inPending || outPending;
  if (ink)
    return (
      <section aria-label="Your clock" className="rounded-card bg-ink-800 p-6 text-paper-100 shadow-raised">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="label-caps text-(--acc-tint)">Your clock</p>
          <Chip tone={running ? "ok" : "neutral"}>{running ? "Clocked in" : "Clocked out"}</Chip>
        </div>
        <p className="mt-4 font-title text-h3 text-paper-0">{running ? "You are working" : "Not working now"}</p>
        <p className="mt-1 text-small font-normal text-ink-300">{running ? `Since ${sinceLabel}` : "Clock in when you start working."}</p>
        <form action={running ? outAction : inAction} className="mt-5">
          <input type="hidden" name="brandId" value={brandId} />
          <Btn type="submit" variant={running ? "secondary" : "primary"} disabled={busy} className={running ? "w-full bg-paper-0" : "w-full"}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-label="Working" /> : running ? <LogOut className="size-4" aria-hidden /> : <LogIn className="size-4" aria-hidden />}
            {running ? "Clock out" : "Clock in"}
          </Btn>
        </form>
        {state.error && (
          <div className="mt-4">
            <Alert tone="bad" role="alert">
              {state.error}
            </Alert>
          </div>
        )}
      </section>
    );
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
