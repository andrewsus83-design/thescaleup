"use client";

// Small UI primitives for the Chat Room. Dark/coral like /admin; coral buttons use dark ink for text
// (white on coral is only 3.2:1, ink on coral is 6.3:1).

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Btn({ variant = "secondary", size = "md", className, children, ...rest }: BtnProps) {
  const v = {
    primary: "bg-coral font-semibold text-ink hover:bg-coral-soft",
    secondary: "border border-white/12 text-mist hover:bg-white/5",
    ghost: "text-slate-300 hover:bg-white/5 hover:text-mist",
    danger: "border border-bad/40 text-bad hover:bg-bad/10",
  }[variant];
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70 disabled:pointer-events-none disabled:opacity-45",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        v,
        className,
      )}
    >
      {children}
    </button>
  );
}

export type Tone = "neutral" | "good" | "warn" | "bad" | "coral" | "info";
const TONES: Record<Tone, string> = {
  neutral: "border-white/10 bg-white/5 text-slate-300",
  good: "border-good/30 bg-good/10 text-good",
  warn: "border-warn/30 bg-warn/10 text-warn",
  bad: "border-bad/30 bg-bad/10 text-red-400",
  coral: "border-coral/30 bg-coral/10 text-coral",
  info: "border-sky-400/30 bg-sky-400/10 text-sky-300",
};

export function Chip({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", TONES[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

/** Thin progress bar; the fill carries the tone, the track is a lighter step of the same hue. */
export function Bar({ value, max = 100, tone = "coral", label }: { value: number; max?: number; tone?: "coral" | "good" | "warn" | "bad"; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fill = { coral: "bg-coral", good: "bg-good", warn: "bg-warn", bad: "bg-bad" }[tone];
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} className="h-2 w-full overflow-hidden rounded-full bg-white/8">
      <div className={cn("h-full rounded-full transition-[width] duration-300", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Radio-style segmented control. */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-current/25 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current",
            value === o.value ? "bg-current/20" : "opacity-80 hover:opacity-100",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

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
      className="mb-0 mt-auto w-full max-w-none rounded-t-3xl border border-white/10 bg-surface p-0 text-mist backdrop:bg-black/60 sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      {open && (
        <>
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-3.5">
            <h2 className="font-display text-base font-bold">{title}</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="max-h-[75dvh] overflow-y-auto p-5">{children}</div>
        </>
      )}
    </dialog>
  );
}

/** Field wrapper used by the forms. */
export const inputCls =
  "w-full rounded-xl border border-white/10 bg-ink/40 px-3.5 py-2.5 text-sm text-mist placeholder:text-slate-400 focus-visible:border-coral/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40";
