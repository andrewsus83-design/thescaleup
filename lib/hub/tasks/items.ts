// Pure rules for a task's checklist: how items are typed or pasted, ordered and counted. No I/O and no imports.

export const ITEM_LIMITS = { perTask: 100, text: 300 } as const;

export type Item = { id: string; body: string; done: boolean; position: number };
export type NewItem = { body: string; done: boolean };

const BULLET = /^(?:[-*+•]\s+|\d{1,3}[.)]\s+)/;
const BOX = /^\[( |x|X)\]\s*/;

/**
 * What was typed or pasted into the add box: one item per line. A pasted markdown list works too: "- [ ] write copy" is
 * "write copy", and "- [x] write copy" is already ticked. Blank lines are skipped.
 */
export function splitItems(raw: string, room: number = ITEM_LIMITS.perTask): { ok: true; items: NewItem[] } | { ok: false; error: string } {
  const items: NewItem[] = [];
  for (const line of raw.split(/\r?\n/)) {
    let s = line.trim().replace(BULLET, "");
    let done = false;
    const box = BOX.exec(s);
    if (box) {
      done = box[1] !== " ";
      s = s.slice(box[0].length);
    }
    s = s.replace(/\s+/g, " ").trim();
    if (!s) continue;
    if (s.length > ITEM_LIMITS.text) return { ok: false, error: `An item can be up to ${ITEM_LIMITS.text} characters. Split it into two.` };
    items.push({ body: s, done });
  }
  if (items.length === 0) return { ok: false, error: "Type an item first." };
  if (items.length > room) return { ok: false, error: room <= 0 ? `A task can hold up to ${ITEM_LIMITS.perTask} items.` : `Only ${room} more ${room === 1 ? "item fits" : "items fit"}: a task can hold up to ${ITEM_LIMITS.perTask}.` };
  return { ok: true, items };
}

/** A single item's text when it is renamed: one line, trimmed. */
export function itemText(raw: string): { ok: true; body: string } | { ok: false; error: string } {
  const s = raw.replace(/\s+/g, " ").trim();
  if (!s) return { ok: false, error: "An item cannot be empty. Delete it instead." };
  if (s.length > ITEM_LIMITS.text) return { ok: false, error: `An item can be up to ${ITEM_LIMITS.text} characters.` };
  return { ok: true, body: s };
}

export const progressOf = (items: readonly { done: boolean }[]) => ({ done: items.filter((i) => i.done).length, total: items.length });

/** Positions for `n` new items placed after the last one. */
export const appendPositions = (existing: readonly { position: number }[], n: number): number[] => {
  const last = existing.reduce((m, i) => Math.max(m, i.position), 0);
  return Array.from({ length: n }, (_, i) => last + i + 1);
};

/** Moving an item up or down swaps places with its neighbour. Returns the two new positions, or null at the end of the list. */
export function swapWithNeighbour(items: readonly { id: string; position: number }[], id: string, dir: "up" | "down"): { a: { id: string; position: number }; b: { id: string; position: number } } | null {
  const sorted = [...items].sort((x, y) => x.position - y.position);
  const at = sorted.findIndex((i) => i.id === id);
  const other = sorted[dir === "up" ? at - 1 : at + 1];
  if (at < 0 || !other) return null;
  const me = sorted[at];
  if (me.position === other.position) return { a: { id: me.id, position: me.position + (dir === "up" ? -0.5 : 0.5) }, b: { id: other.id, position: other.position } };
  return { a: { id: me.id, position: other.position }, b: { id: other.id, position: me.position } };
}
