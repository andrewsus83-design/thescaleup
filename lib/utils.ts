import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The brand's custom utilities (BRAND §4 type sizes, `--text-*`; the 1.5px control border, `border-control`; app/globals.css) are
// a font size and a border width, not colours. Without this, tailwind-merge reads `text-caption` as a text colour and
// `border-control` as a border colour, and drops them whenever a real colour such as `text-ink-500` or `border-ink-200` follows.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "h1", "h2", "h3", "body-lg", "body", "small", "code", "button", "caption", "micro"] }],
      "border-w": [{ border: ["control"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Indonesian Rupiah, e.g. 75000000 -> "Rp 75.000.000" */
export function rupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}
