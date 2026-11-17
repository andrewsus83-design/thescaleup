// A CRM list as a CSV file Excel opens correctly. Pure, no I/O.

import { labelOf, type Person, type StageDef } from "./model";

export const EXPORT_HEADERS = ["Name", "Company", "Email", "Phone", "Source", "Stage", "Value", "Next follow-up", "Tags", "Notes", "Added"] as const;

/**
 * A text cell that cannot run as a formula. A spreadsheet treats a cell starting with = + - @ (or a tab or return) as a formula, and
 * a lead typed into a public form could start that way, so such cells get a leading apostrophe.
 */
export function safeCell(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

const quote = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** One CSV: a byte-order mark (so Excel reads accents and Indonesian text), a heading row, then one row per person. Lines end in CRLF. */
export function toCsv(people: readonly Person[], stages: readonly StageDef[]): string {
  const lines: string[] = [EXPORT_HEADERS.join(",")];
  for (const p of people) {
    const cells = [
      safeCell(p.name),
      safeCell(p.company),
      safeCell(p.email),
      // A phone number keeps its leading +: the import cleans it to digits and + - ( ) . and spaces only, so it holds no formula.
      p.phone,
      safeCell(p.source),
      safeCell(labelOf(stages, p.stage)),
      p.value === null ? "" : String(p.value),
      p.next_follow_up ?? "",
      safeCell(p.tags.join(", ")),
      safeCell(p.summary),
      p.created_at.slice(0, 10),
    ];
    lines.push(cells.map(quote).join(","));
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
