"use client";

import { useState } from "react";

/** Read-only text field with a copy button (for share/connect links). */
export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      {label && <p className="mb-1.5 text-xs font-medium text-slate-500">{label}</p>}
      <div className="flex items-stretch gap-2">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700"
        />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard blocked — user can select manually */
            }
          }}
          className="shrink-0 rounded-lg bg-[#2A2870] px-3 py-2 text-xs font-semibold text-white hover:bg-[#211f5c]"
        >
          {copied ? "Tersalin ✓" : "Salin"}
        </button>
      </div>
    </div>
  );
}
