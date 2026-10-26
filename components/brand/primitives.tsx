// Brand v2 UI primitives (BRAND.md §7) that need no browser state: pill buttons, status chips (dot + label), progress,
// alerts, cards, the empty state and the page header. NO "use client": a server component (the report views) and a
// client component (the Chat Room) render the same ones. Light "paper" theme: Scale Orange for the one main action,
// Ink for text and structure, Paper for surfaces. Keyboard focus rings come from `.room-app` / `.brand-app` in globals.css.
// The interactive ones (Segmented, Sheet) stay in components/room/ui.tsx.

import { cn } from "@/lib/utils";
import { btnCls, cardCls, iconBtnCls, tagCls, type BtnSize, type BtnVariant } from "./styles";

// ---------------------------------------------------------------------------------------------- Buttons
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize };

export function Btn({ variant = "secondary", size = "md", className, children, ...rest }: BtnProps) {
  return (
    <button type="button" {...rest} className={btnCls(variant, size, className)}>
      {children}
    </button>
  );
}

/** Round icon button, 44px. Always labelled. */
export function IconBtn({
  label,
  variant = "quiet",
  className,
  children,
  ...rest
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & { label: string; variant?: "primary" | "quiet" }) {
  return (
    <button type="button" aria-label={label} {...rest} className={iconBtnCls(variant, className)}>
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
    <span className={cn("inline-flex h-8 items-center gap-2 rounded-full px-3.5 text-caption font-semibold leading-none", t.box, className)}>
      {t.dot && <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", t.dot)} />}
      {children}
    </span>
  );
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn(tagCls, className)}>{children}</span>;
}

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
  tone?: "brand" | "ok" | "warn" | "bad" | "neutral" | "ink";
  label: string;
  onDark?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fill = { brand: "bg-brand-500", ok: "bg-success", warn: "bg-warning", bad: "bg-danger", neutral: "bg-ink-500", ink: "bg-ink-800" }[tone];
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

// ---------------------------------------------------------------------------------------------- Alert, card, page frame
const ALERT = {
  warn: { box: "bg-warning-bg", dot: "bg-warning" },
  info: { box: "bg-info-bg", dot: "bg-info" },
  ok: { box: "bg-success-bg", dot: "bg-success" },
  bad: { box: "bg-danger-bg", dot: "bg-danger" },
} as const;
export type AlertTone = keyof typeof ALERT;

/** BRAND "Alert": padding 16/20, radius 16, semantic fill, 8px dot, bold title then the message inline. Stack alerts 12px apart. */
export function Alert({
  tone = "warn",
  title,
  role,
  className,
  children,
}: {
  tone?: AlertTone;
  title?: string;
  role?: "alert" | "status";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role={role} className={cn("flex items-start gap-3 rounded-field px-5 py-4 text-small font-normal text-ink-800", ALERT[tone].box, className)}>
      <Dot className={cn("mt-1.5", ALERT[tone].dot)} />
      <div className="min-w-0">
        {title && <strong className="font-semibold">{title} </strong>}
        {children}
      </div>
    </div>
  );
}

/** BRAND "Card": see `cardCls`. */
export function Card({ className, small, interactive, children }: { className?: string; small?: boolean; interactive?: boolean; children: React.ReactNode }) {
  return <div className={cn(cardCls(small, interactive), className)}>{children}</div>;
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
      <p className="mt-3 font-title text-h2 font-extrabold leading-none">
        {figure}
        {unit && <span className="ml-2 font-mono text-caption font-medium tracking-normal text-ink-300">{unit}</span>}
      </p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

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
    <div className="flex flex-col items-center justify-center rounded-card border-control border-dashed border-ink-200 px-6 py-14 text-center">
      {icon && <span className="mb-4 inline-flex size-12 items-center justify-center rounded-field bg-paper-100 text-ink-500">{icon}</span>}
      <p className="font-title text-h3 text-ink-800">{title}</p>
      {hint && <p className="mt-2 max-w-sm text-pretty text-body text-ink-500">{hint}</p>}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
