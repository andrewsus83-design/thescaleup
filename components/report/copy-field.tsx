"use client";

import { useState } from "react";
import { btnCls, inputCls, labelCls } from "@/components/brand/styles";
import { cn } from "@/lib/utils";

/** Read-only text field with a copy button (for share/connect links). */
export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      {label && <p className={labelCls}>{label}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <input
          readOnly
          aria-label={label ?? "Link"}
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(inputCls, "min-w-0 flex-1 basis-56 font-mono text-caption")}
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
          className={btnCls("dark", "lg")}
        >
          {copied ? "Tersalin ✓" : "Salin"}
        </button>
      </div>
    </div>
  );
}
