import { initialOf, toneOf } from "@/lib/hub/mail/model";
import { cn } from "@/lib/utils";

// Colour pairs from the brand tokens, so the same sender always gets the same circle. The letter is decoration: the name is always next to it.
const TONES = ["bg-brand-50 text-brand-900", "bg-info-bg text-info", "bg-success-bg text-success-ink", "bg-warning-bg text-ink-800", "bg-danger-bg text-danger", "bg-paper-200 text-ink-800"];

export function Avatar({ name, email, className }: { name?: string | null; email: string; className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-full font-title text-body font-semibold", TONES[toneOf(email, TONES.length)], className)}>
      {initialOf(name, email)}
    </span>
  );
}
