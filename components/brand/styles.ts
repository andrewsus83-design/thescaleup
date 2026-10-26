// Brand v2 style helpers (BRAND.md §7) as plain class strings, so a server component, a client component and a <Link>
// can all wear the same button, field or tab. NO "use client" here: a server component may call these.
// Every value is a token from app/globals.css (colour, type size, radius, shadow, spacing); nothing is typed in by hand.

import { cn } from "@/lib/utils";

/** BRAND §8: hover changes colour or elevation only, in 150ms ease-out, and never moves layout. */
export const motion = "transition-[color,background-color,border-color,box-shadow,opacity] duration-150 ease-out";

// ---------------------------------------------------------------------------------------------- Buttons
export type BtnVariant = "primary" | "dark" | "secondary" | "ghost" | "danger";
/** 48 / 44 / 40 / 36px high. `lg` is the page-level call to action, `md` sits in panels, `sm` is inline in chat, `xs` is compact. */
export type BtnSize = "lg" | "md" | "sm" | "xs";

const BTN_SIZE = {
  lg: "h-12 px-7 text-button",
  md: "h-11 px-6 text-button",
  sm: "hit-44 h-10 px-5 text-button",
  xs: "hit-44 h-9 px-4 text-caption",
} as const;

const BTN_VARIANT = {
  // Ink on Orange (5.3:1). White text on Orange is never used, except while pressed.
  primary: "bg-brand-500 text-ink-800 hover:bg-brand-600 active:bg-brand-700 active:text-paper-0",
  dark: "bg-ink-800 text-paper-100 hover:bg-ink-700 active:bg-ink-900",
  secondary: "border-control border-ink-200 text-ink-800 hover:bg-paper-100 active:bg-paper-200",
  // BRAND "Text" button: no fill, Orange 700, underlined
  ghost: "text-brand-700 underline underline-offset-4 hover:bg-brand-50 active:bg-brand-100",
  danger: "border-control border-danger text-danger hover:bg-danger-bg hover:text-ink-800 active:bg-danger-bg",
} as const;

/** The button look as a class string, so a <Link> can wear it too. */
export function btnCls(variant: BtnVariant = "secondary", size: BtnSize = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold leading-none",
    motion,
    BTN_SIZE[size],
    BTN_VARIANT[variant],
    // BRAND "Disabled": Paper-200 fill, Ink-300 text, no pointer
    "disabled:pointer-events-none disabled:border-transparent disabled:bg-ink-100 disabled:text-ink-300 disabled:no-underline",
    variant === "ghost" && "disabled:bg-transparent",
    className,
  );
}

/** Round icon button, 44px. `primary` is the Orange send/add button; `quiet` is for close, edit and similar. */
export function iconBtnCls(variant: "primary" | "quiet" = "quiet", className?: string) {
  return cn(
    "inline-flex size-11 shrink-0 items-center justify-center rounded-full disabled:pointer-events-none",
    motion,
    variant === "primary"
      ? "bg-brand-500 text-ink-800 hover:bg-brand-600 active:bg-brand-700 active:text-paper-0 disabled:bg-ink-100 disabled:text-ink-300"
      : "text-ink-500 hover:bg-paper-100 hover:text-ink-800 active:bg-paper-200 disabled:text-ink-300",
    className,
  );
}

// ---------------------------------------------------------------------------------------------- Chips, tags, pills
/** Small metadata pill (tags, source chips, scope chips): Paper fill, Mono 500 / 11, 28px high. */
export const tagCls = "inline-flex h-7 items-center gap-2 rounded-full bg-paper-100 px-3 font-mono text-micro font-medium leading-none text-ink-800";

/** A filter/toggle pill (36px, aria-pressed). Active is Ink on Paper, like the segmented control. */
export const pillCls = (active: boolean) =>
  cn(
    "hit-44 inline-flex h-9 items-center gap-2 rounded-full border-control px-4 text-caption font-semibold leading-none",
    motion,
    active ? "border-ink-800 bg-ink-800 text-paper-100" : "border-ink-200 text-ink-800 hover:bg-paper-100",
  );

// ---------------------------------------------------------------------------------------------- Segmented / tabs
/** White pill container; the active item is Ink on Paper. Shared by Segmented and the Project tabs. */
export const segWrap = "inline-flex gap-1 rounded-full bg-paper-0 p-1";
export const segItem = (active: boolean, size: "md" | "sm" = "md") =>
  cn(
    "inline-flex items-center justify-center rounded-full font-semibold leading-none",
    motion,
    size === "md" ? "hit-44 h-10 px-5 text-small" : "hit-44 h-8 px-4 text-caption",
    active ? "bg-ink-800 text-paper-100" : "text-ink-500 hover:text-ink-800",
  );

// ---------------------------------------------------------------------------------------------- Page frame
/** Page margin from BRAND §5: 20 on phones, 32 on tablet, 48 on desktop. Chat columns reach 48 at `xl`, where the 300px context column leaves them room. */
export const pageX = "px-5 sm:px-8 lg:px-12";
export const chatX = "px-5 sm:px-8 xl:px-12";

/** BRAND "Card": white, radius 28, 32px padding (24 on phones), hairline border, raised shadow. `small` is the 24px-radius card for lists and side panels. */
export const cardCls = (small?: boolean, interactive?: boolean) =>
  cn("border border-hairline bg-paper-0 shadow-raised", small ? "rounded-bubble p-5" : "rounded-card p-6 sm:p-8", interactive && cn("hover:shadow-overlay", motion));

/** A tile inside a card: Paper fill, radius 16, no line (BRAND: use Paper to separate areas, not borders). */
export const tileCls = "rounded-field bg-paper-100 p-5";

/** Section label above a group: Mono 500 / 11 caps. */
export const capsCls = "label-caps text-ink-500";

// ---------------------------------------------------------------------------------------------- Fields
/** Label above the field: Body 600 / 14, 8px gap. */
export const labelCls = "mb-2 block text-small font-semibold text-ink-800";

/**
 * BRAND "Input": 56px, 20px side padding, radius 16, white. Focus is an Ink border plus a 4px Orange-100 ring; error is a Danger border
 * (set `aria-invalid`). Placeholders use Ink-500 (5.5:1) rather than Ink-300, which is only 2.1:1 on white.
 * The 1.5px Ink-200 border is not in BRAND (transparent there): most fields sit on white cards, where a borderless white field would vanish.
 */
export const inputCls = cn(
  "block h-14 w-full text-ellipsis rounded-field border-control border-ink-200 bg-paper-0 px-5 text-body text-ink-800 outline-none placeholder:text-ink-500",
  "focus-visible:border-ink-800 focus-visible:shadow-focus aria-invalid:border-danger disabled:bg-paper-100 disabled:text-ink-300",
  motion,
);
/** Same field for multi-line text: at least 56px, grows with its rows. */
export const textareaCls = cn(inputCls, "h-auto min-h-14 resize-y py-4");
/** Error text under a field: 13px Danger, 8px below. */
export const errorCls = "mt-2 text-caption text-danger";
