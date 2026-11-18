// Money, shared by every part of the hub that counts it. Pure: no I/O, so the browser can import it and the sums are easy to test.
// An amount is kept in hundredths of the currency unit, as a whole number, so adding up never drifts.

export const CURRENCIES = ["IDR", "USD", "SGD", "MYR", "PHP", "THB", "VND", "INR", "AUD", "EUR", "GBP", "JPY", "KRW", "CNY", "HKD", "AED", "SAR", "CAD"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const isCurrency = (v: unknown): v is Currency => typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);

/** Currencies that are not written with cents. */
const WHOLE_UNIT = new Set<string>(["IDR", "VND", "JPY", "KRW"]);

/** The most one amount can be: a trillion units. Far above any real entry, and far below where whole numbers stop being exact. */
export const MAX_CENTS = 1_000_000_000_000 * 100;

/**
 * An amount as a person types it, in hundredths. Reads both "12.000.000" and "12,000,000", and "1,250.50" and "1.250,50".
 * One lone separator followed by exactly three digits is read as thousands ("1.500" is one thousand five hundred). null when it is not an amount.
 */
export function parseMoney(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const s = input.replace(/\s/g, "");
  if (!s || !/^\d[\d.,]*$/.test(s) || /[.,]$/.test(s)) return null;
  const dots = (s.match(/\./g) ?? []).length;
  const commas = (s.match(/,/g) ?? []).length;
  let whole = s;
  let frac = "";
  const split = (sep: string) => {
    const i = s.lastIndexOf(sep);
    whole = s.slice(0, i);
    frac = s.slice(i + 1);
  };
  if (dots > 0 && commas > 0) split(s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",");
  else if (dots + commas === 1) {
    const sep = dots ? "." : ",";
    const after = s.length - s.lastIndexOf(sep) - 1;
    if (after !== 3) split(sep);
  }
  if (frac.length > 2 || /[.,]/.test(frac)) return null;
  const groups = whole.split(/[.,]/);
  // Thousands groups are three digits; the Indian way of writing (12,00,000) has groups of two before the last one.
  if (groups.length > 1 && (groups[0].length > 3 || groups[0].length === 0 || groups.slice(1).some((g, i, rest) => (i === rest.length - 1 ? g.length !== 3 : g.length !== 2 && g.length !== 3)))) return null;
  const digits = groups.join("");
  if (!digits || digits.length > 13) return null;
  const cents = Number(digits) * 100 + Number(frac.padEnd(2, "0") || "0");
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : null;
}

/** An amount for reading, with its currency. */
export function fmtMoney(cents: number, currency: string): string {
  const whole = WHOLE_UNIT.has(currency) || cents % 100 === 0;
  try {
    return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", { style: "currency", currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
}

/** An amount for an input field: plain digits, no currency, so it can be typed over. */
export const moneyInput = (cents: number) => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));
