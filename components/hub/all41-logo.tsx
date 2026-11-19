import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Hub-only All41 wordmark. Do not replace legacy logos in unrelated archived or
 * event products. Mark geometry belongs here; colors always resolve via tokens.
 */
export function All41Mark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn("shrink-0 text-brand-500", className)}
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="26" y="8" width="17" height="28" rx="8.5" transform="rotate(-35 34.5 22)" />
      <rect x="9" y="29" width="17" height="27" rx="8.5" transform="rotate(40 17.5 42.5)" />
      <rect x="34" y="30" width="17" height="27" rx="8.5" transform="rotate(-11 42.5 43.5)" />
    </svg>
  );
}

export function All41Logo({
  href,
  compact = false,
  className,
}: {
  href?: string;
  compact?: boolean;
  className?: string;
}) {
  const contents = (
    <>
      <All41Mark size={compact ? 28 : 34} />
      {!compact && (
        <span className="font-title text-h4 font-extrabold tracking-tight text-ink-800">
          All<span className="text-brand-700">41</span>
        </span>
      )}
    </>
  );
  const classes = cn("inline-flex items-center gap-2.5", className);
  return href ? <Link href={href} className={classes} aria-label="All41 home">{contents}</Link> : <span className={classes}>{contents}</span>;
}
