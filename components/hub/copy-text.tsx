"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Btn } from "@/components/brand/primitives";

/** A block of text with a Copy button, for something the person will paste into another app. */
export function CopyText({ text, label, button = "Copy message" }: { text: string; label: string; button?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "blocked">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("blocked"); // the browser refused: the text is selectable, so they can copy it by hand
    }
  }
  return (
    <div className="space-y-3">
      <p className="whitespace-pre-line rounded-xl border border-ink-100 bg-paper-50 p-4 text-small text-ink-700 select-all">{text}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Btn variant="secondary" onClick={copy} aria-label={label}>
          {state === "copied" ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {state === "copied" ? "Copied" : button}
        </Btn>
        {state === "blocked" && <span className="text-caption text-ink-500" role="status">Your browser would not copy it. Select the text above and copy it by hand.</span>}
      </div>
    </div>
  );
}
