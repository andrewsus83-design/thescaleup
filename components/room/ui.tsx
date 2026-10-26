"use client";

// Brand v2 UI primitives for the Chat Room (BRAND.md §7): pill buttons, status chips (dot + label), progress,
// segmented tabs, alerts, cards, the modal sheet and field styles. Light "paper" theme: Scale Orange for the one
// main action, Ink for text and structure, Paper for surfaces. Keyboard focus rings come from `.room-app` in
// globals.css; inputs draw their own 4px ring below.

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** BRAND §8: hover changes colour or elevation only, in 150ms ease-out, and never moves layout. */
export const motion = "transition-[color,background-color,border-color,box-shadow,opacity] duration-150 ease-out";

// ---------------------------------------------------------------------------------------------- Buttons
type BtnVariant = "primary" | "dark" | "secondary" | "ghost" | "danger";
/** 48 / 44 / 40 / 36px high. `lg` is the page-level call to action, `md` sits in panels, `sm` is inline in chat, `xs` is compact. */
type BtnSize = "lg" | "md" | "sm" | "xs";
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize };

const BTN_SIZE = {
  lg: "h-12 px-7 text-[15px]",
  md: "h-11 px-6 text-[15px]",
  sm: "hit-44 h-10 px-5 text-[15px]",
  xs: "hit-44 h-9 px-4 text-[13px]",
} as const;

const BTN_VARIANT = {
  // Ink on Orange (5.3:1). White text on Orange is never used, except while pressed.
  primary: "bg-brand-500 text-ink-800 hover:bg-brand-600 active:bg-brand-700 active:text-paper-0",
  dark: "bg-ink-800 text-paper-100 hover:bg-ink-700 active:bg-ink-900",
  secondary: "border-[1.5px] border-ink-200 text-ink-800 hover:bg-paper-100 active:bg-paper-200",
  // BRAND "Text" button: no fill, Orange 700, underlined
  ghost: "text-brand-700 underline underline-offset-4 hover:bg-brand-50 active:bg-brand-100",
  danger: "border-[1.5px] border-danger text-danger hover:bg-danger-bg hover:text-ink-800 active:bg-danger-bg",
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

export function Btn({ variant = "secondary", size = "md", className, children, ...rest }: BtnProps) {
  return (
    <button type="button" {...rest} className={btnCls(variant, size, className)}>
      {children}
    </button>
  );
}

/** Round icon button, 44px. `primary` is the Orange send/add button; `quiet` is for close, edit and similar. Always labelled. */
export function IconBtn({
  label,
  variant = "quiet",
  className,
  children,
  ...rest
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & { label: string; variant?: "primary" | "quiet" }) {
  return (
    <button
      type="button"
      aria-label={label}
      {...rest}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full disabled:pointer-events-none",
        motion,
        variant === "primary"
          ? "bg-brand-500 text-ink-800 hover:bg-brand-600 active:bg-brand-700 active:text-paper-0 disabled:bg-ink-100 disabled:text-ink-300"
          : "text-ink-500 hover:bg-paper-100 hover:text-ink-800 active:bg-paper-200 disabled:text-ink-300",
        className,
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------------------------- Chips
export type Tone = "neutral" | "ok" | "warn" | "bad" | "brand" | "info" | "count";

// Status chips always carry a dot AND a label — colour is never the only signal. Text colours are chosen for 4.5:1 on the fill.
const CHIP: Record<Tone, { box: string; dot?: string }> = {
  neutral: { box: "border border-ink-100 bg-paper-0 text-ink-500", dot: "bg-ink-300" },
  ok: { box: "bg-success-bg text-success-ink", dot: "bg-success" },
  warn: { box: "bg-warning-bg text-ink-800", dot: "bg-warning" },
  bad: { box: "bg-danger-bg text-ink-800", dot: "bg-danger" },
  brand: { box: "bg-brand-chip text-brand-chip-ink", dot: "bg-brand-500" },
  info: { box: "bg-info-bg text-ink-800", dot: "bg-info" },
  // "Count": Ink fill, Mono, no dot — e.g. `To do 14`
  count: { box: "bg-ink-800 font-mono font-medium text-paper-100" },
};

export function Chip({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  const t = CHIP[tone];
  return (
    <span className={cn("inline-flex h-8 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold leading-none", t.box, className)}>
      {t.dot && <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", t.dot)} />}
      {children}
    </span>
  );
}

/** Small metadata pill (tags, source chips): Paper fill, Mono 500 / 11, 28px high. */
export const tagCls = "inline-flex h-7 items-center gap-1.5 rounded-full bg-paper-100 px-3 font-mono text-[11px] font-medium leading-none text-ink-800";
export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn(tagCls, className)}>{children}</span>;
}

/** A filter/toggle pill (36px, aria-pressed). Active is Ink on Paper, like the segmented control. */
export const pillCls = (active: boolean) =>
  cn(
    "hit-44 inline-flex h-9 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-[13px] font-semibold leading-none",
    motion,
    active ? "border-ink-800 bg-ink-800 text-paper-100" : "border-ink-200 text-ink-800 hover:bg-paper-100",
  );

/** Round status dot, 8px. */
export function Dot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", className)} />;
}

// ---------------------------------------------------------------------------------------------- Progress
/** Progress/context meter: a 6px Hairline track with an Orange fill. On an Ink panel use `onDark`. */
export function Bar({
  value,
  max = 100,
  tone = "brand",
  label,
  onDark,
}: {
  value: number;
  max?: number;
  tone?: "brand" | "ok" | "warn" | "bad" | "neutral";
  label: string;
  onDark?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fill = { brand: "bg-brand-500", ok: "bg-success", warn: "bg-warning", bad: "bg-danger", neutral: "bg-ink-500" }[tone];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className={cn("h-1.5 w-full overflow-hidden rounded-full", onDark ? "bg-ink-700" : "bg-hairline")}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-300 ease-out", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- Segmented / tabs
/** White pill container; the active item is Ink on Paper. Shared by Segmented and the Project tabs. */
export const segWrap = "inline-flex gap-1 rounded-full bg-paper-0 p-1";
export const segItem = (active: boolean, size: "md" | "sm" = "md") =>
  cn(
    "inline-flex items-center justify-center rounded-full font-semibold leading-none",
    motion,
    size === "md" ? "hit-44 h-10 px-5 text-[14px]" : "hit-44 h-8 px-4 text-[13px]",
    active ? "bg-ink-800 text-paper-100" : "text-ink-500 hover:text-ink-800",
  );

/** Radio-style segmented control. */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  size = "md",
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  size?: "md" | "sm";
}) {
  return (
    <div role="radiogroup" aria-label={label} className={segWrap}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={segItem(value === o.value, size)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- Alert, card, page frame
const ALERT = {
  warn: { box: "bg-warning-bg", dot: "bg-warning" },
  info: { box: "bg-info-bg", dot: "bg-info" },
  ok: { box: "bg-success-bg", dot: "bg-success" },
  bad: { box: "bg-danger-bg", dot: "bg-danger" },
} as const;

/** BRAND "Alert": padding 16/20, radius 16, semantic fill, 8px dot, bold title then the message inline. Stack alerts 12px apart. */
export function Alert({
  tone = "warn",
  title,
  role,
  className,
  children,
}: {
  tone?: keyof typeof ALERT;
  title?: string;
  role?: "alert" | "status";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role={role} className={cn("flex items-start gap-3 rounded-field px-5 py-4 text-[14px] leading-[1.5] text-ink-800", ALERT[tone].box, className)}>
      <Dot className={cn("mt-1.5", ALERT[tone].dot)} />
      <div className="min-w-0">
        {title && <strong className="font-semibold">{title} </strong>}
        {children}
      </div>
    </div>
  );
}

/** BRAND "Card": white, radius 28, 32px padding (24 on phones), hairline border, raised shadow. `small` is the 24px-radius card for lists and side panels. */
export function Card({ className, small, interactive, children }: { className?: string; small?: boolean; interactive?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "border border-hairline bg-paper-0 shadow-raised",
        small ? "rounded-bubble p-5" : "rounded-card p-6 sm:p-8",
        interactive && cn("hover:shadow-overlay", motion),
        className,
      )}
    >
      {children}
    </div>
  );
}

/** BRAND "Panel budget": an Ink panel (radius 20, padding 20) with a Mono Orange label, the figure in Title 800 32 and, below, a meter. */
export function BudgetPanel({
  label,
  figure,
  unit,
  live,
  className,
  children,
}: {
  label: string;
  figure: React.ReactNode;
  unit?: React.ReactNode;
  /** A figure that changes while you watch (a running audit) is announced as a status. */
  live?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div role={live ? "status" : undefined} className={cn("rounded-panel bg-ink-800 p-5 text-paper-100", className)}>
      <p className="font-mono text-code uppercase text-brand-500">{label}</p>
      <p className="mt-3 font-title text-[32px] font-extrabold leading-none tracking-[-0.02em]">
        {figure}
        {unit && <span className="ml-2 font-mono text-[13px] font-medium tracking-normal text-ink-300">{unit}</span>}
      </p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/** Page margin from BRAND §5: 20 on phones, 32 on tablet, 48 on desktop. Chat columns reach 48 at `xl`, where the 300px context column leaves them room. */
export const pageX = "px-5 sm:px-8 lg:px-12";
export const chatX = "px-5 sm:px-8 xl:px-12";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h1 className="font-title text-balance text-h2 text-ink-800">{title}</h1>
        {description && <p className="mt-2 max-w-chat text-pretty text-body text-ink-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** BRAND "Empty": dashed 1.5px Ink-200 border, radius 28. Pass `onClick`-free content; use `Btn` in `children` for an action. */
export function EmptyState({ icon, title, hint, children }: { icon?: React.ReactNode; title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border-[1.5px] border-dashed border-ink-200 px-6 py-14 text-center">
      {icon && <span className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-paper-100 text-ink-500">{icon}</span>}
      <p className="font-title text-h3 text-ink-800">{title}</p>
      {hint && <p className="mt-2 max-w-sm text-pretty text-body text-ink-500">{hint}</p>}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- Sheet
/**
 * Modal sheet on the native <dialog>: focus trap, Esc to close and inert background come from the
 * browser. A bottom sheet on phones, a centred card from `sm` up. Children mount only while open.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // a click on the backdrop
      }}
      className="mb-0 mt-auto w-full max-w-none rounded-t-card border-0 bg-paper-0 p-0 text-ink-800 shadow-overlay backdrop:bg-ink-800/40 sm:m-auto sm:max-w-lg sm:rounded-card"
    >
      {open && (
        <>
          <div className="flex items-center justify-between gap-4 px-6 pt-6 sm:px-8 sm:pt-8">
            <h2 className="font-title text-h3 text-ink-800">{title}</h2>
            <IconBtn label="Close" onClick={onClose} className="-mr-2">
              <X className="size-5" aria-hidden />
            </IconBtn>
          </div>
          <div className="max-h-[75dvh] overflow-y-auto px-6 pb-6 pt-4 sm:px-8 sm:pb-8">{children}</div>
        </>
      )}
    </dialog>
  );
}

// ---------------------------------------------------------------------------------------------- Fields
/** Label above the field: Body 600 / 14, 8px gap. */
export const labelCls = "mb-2 block text-[14px] font-semibold text-ink-800";

/**
 * BRAND "Input": 56px, 20px side padding, radius 16, white. Focus is an Ink border plus a 4px Orange-100 ring; error is a Danger border
 * (set `aria-invalid`). Placeholders use Ink-500 (5.5:1) rather than Ink-300, which is only 2.1:1 on white.
 * The 1.5px Ink-200 border is not in BRAND (transparent there): most fields sit on white cards, where a borderless white field would vanish.
 */
export const inputCls = cn(
  "block h-14 w-full text-ellipsis rounded-field border-[1.5px] border-ink-200 bg-paper-0 px-5 text-body text-ink-800 outline-none placeholder:text-ink-500",
  "focus-visible:border-ink-800 focus-visible:shadow-[0_0_0_4px_var(--color-brand-100)] aria-invalid:border-danger disabled:bg-paper-100 disabled:text-ink-300",
  motion,
);
/** Same field for multi-line text: at least 56px, grows with its rows. */
export const textareaCls = cn(inputCls, "h-auto min-h-14 resize-y py-4");
/** Error text under a field: 13px Danger, 8px below. */
export const errorCls = "mt-2 text-[13px] text-danger";
