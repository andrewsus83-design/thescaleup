"use client";

// Brand v2 UI for the Chat Room (BRAND.md §7). The look lives in components/brand: `styles.ts` (class strings) and
// `primitives.tsx` (buttons, chips, progress, alerts, cards), which carry no browser state and so are shared with the
// server-rendered report. This file re-exports them under the path the Room always imported from, and adds the two pieces
// that need the browser: the radio-style Segmented control and the modal Sheet.

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { IconBtn } from "@/components/brand/primitives";
import { segItem, segWrap } from "@/components/brand/styles";

export * from "@/components/brand/styles";
export * from "@/components/brand/primitives";

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
