import { cn } from "@/lib/utils";

// thescaleup logo (BRAND.md §2). Concept: a bar as the target, a chevron as the jump. One colour, rounded corners.
// The 100x100 viewBox already holds the clear space (1x the bar height on every side), so the mark never needs padding.
// Don't rotate it, add gradients or shadows, stretch it, or recolour it outside the four variants below.

const MARK_RECT = { x: 14, y: 14, width: 72, height: 14, rx: 5 };
const MARK_PATH = "M50 40 L84 74 Q88 79 83 84 Q78 88 73 83 L50 60 L27 83 Q22 88 17 84 Q12 79 16 74 Z";

/** The bare mark in the current text colour. Minimum 16px on screen. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="currentColor" aria-hidden="true" className={cn("shrink-0", className)}>
      <rect {...MARK_RECT} />
      <path d={MARK_PATH} />
    </svg>
  );
}

/**
 * primary  — Orange mark on an Ink tile (the default app mark)
 * inverse  — Ink mark on an Orange tile (also the chat bot avatar, with `shape="circle"`)
 * mono     — Ink mark on Paper (single-colour print, embossing)
 * lockup   — Orange mark + lowercase wordmark in Ink, on Paper or white
 */
export type LogoVariant = "primary" | "inverse" | "mono" | "lockup";

const TILE: Record<Exclude<LogoVariant, "lockup">, string> = {
  primary: "bg-ink-800 text-brand-500",
  inverse: "bg-brand-500 text-ink-800",
  mono: "bg-paper-100 text-ink-800",
};

export function Logo({
  variant = "lockup",
  size = 32,
  shape = "square",
  className,
}: {
  variant?: LogoVariant;
  /** Mark (or tile) edge in px; never below 16. */
  size?: number;
  /** Tiles only: the avatar uses a circle. */
  shape?: "square" | "circle";
  className?: string;
}) {
  const px = Math.max(16, size);

  if (variant === "lockup") {
    return (
      <span className={cn("inline-flex items-center", className)} style={{ gap: Math.round(px * 0.3) }}>
        <LogoMark size={px} className="text-brand-500" />
        <span className="font-title font-extrabold leading-none tracking-[-0.03em] text-ink-800" style={{ fontSize: Math.round(px * 0.72) }}>
          thescaleup
        </span>
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center", shape === "circle" ? "rounded-full" : "rounded-[22%]", TILE[variant], className)}
      style={{ width: px, height: px }}
    >
      <LogoMark size={Math.round(px * (shape === "circle" ? 0.66 : 0.84))} />
    </span>
  );
}
