import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Indonesian Rupiah, e.g. 75000000 -> "Rp 75.000.000" */
export function rupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}
