// Month grid for the calendar view. Weeks start on Monday (Indonesia and most of the world).

import { addDays, isMonthKey, monthKey, startOfWeek } from "./dates";

export type Cell = { iso: string; inMonth: boolean };

/** Whole weeks that cover the month, Monday first: 4 to 6 rows of 7. */
export function monthGrid(key: string): Cell[][] {
  const first = `${key}-01`;
  const next = `${monthKey(addDays(first, 32))}-01`; // first day of the following month
  const last = addDays(next, -1);
  const rows: Cell[][] = [];
  for (let start = startOfWeek(first); start <= last; start = addDays(start, 7)) {
    rows.push(Array.from({ length: 7 }, (_, i) => {
      const iso = addDays(start, i);
      return { iso, inMonth: monthKey(iso) === key };
    }));
  }
  return rows;
}

/** The month from ?m=YYYY-MM, or the month of `today` when it is missing or wrong. */
export const parseMonth = (q: string | undefined, today: string) => (isMonthKey(q) ? q : monthKey(today));

/** Groups tasks by due day. Tasks without a due date are left out (the page says how many). */
export function byDay<T extends { due_date: string | null }>(tasks: readonly T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of tasks) {
    if (!t.due_date) continue;
    const list = m.get(t.due_date);
    if (list) list.push(t);
    else m.set(t.due_date, [t]);
  }
  return m;
}
