// Pure rules for the Wiki: page types, how a form becomes a page, tags, slugs, the page tree and a check for pasted secrets. No I/O.

import { slugify } from "../slug";

export const TYPES = ["brand", "product", "sop", "training", "research", "update", "customer", "person", "faq", "other"] as const;
export type PageType = (typeof TYPES)[number];

type TypeInfo = { label: string; hint: string; /** Whether AI features may read a new page of this type until someone changes it. */ ai: boolean; starter: string };

export const TYPE_INFO: Record<PageType, TypeInfo> = {
  brand: { label: "Brand", hint: "Voice, values, who it is for", ai: true, starter: "## Who we are\n\n## Who we talk to\n\n## How we sound\n\n## Words we use and avoid\n" },
  product: { label: "Product or service", hint: "What is sold, for how much, to whom", ai: true, starter: "## What it is\n\n## Who it is for\n\n## Price and packages\n\n## Common questions\n" },
  sop: { label: "How we work", hint: "Steps for a task, in order", ai: true, starter: "## Why this matters\n\n## Steps\n\n1. \n2. \n3. \n\n## Who to ask\n" },
  training: { label: "Training", hint: "Lessons for new and current people", ai: true, starter: "## What you will learn\n\n## Lesson\n\n## Check yourself\n" },
  research: { label: "Research", hint: "Market, competitor and content findings", ai: true, starter: "## Question\n\n## What we found\n\n## Sources\n\n## What we do with it\n" },
  update: { label: "Update", hint: "Progress, decisions and news, by date", ai: true, starter: "## Summary\n\n## Done\n\n## Next\n\n## Blocked\n" },
  customer: { label: "Customer", hint: "Audience and customer profiles", ai: true, starter: "## Who they are\n\n## What they want\n\n## What stops them\n" },
  person: { label: "Person or role", hint: "Who does what", ai: false, starter: "## Role\n\n## Responsible for\n\n## Works with\n" },
  faq: { label: "FAQ", hint: "Questions people ask, with answers", ai: true, starter: "## Question\n\nAnswer.\n" },
  other: { label: "Other", hint: "Anything else", ai: true, starter: "" },
};

export const isType = (v: unknown): v is PageType => typeof v === "string" && (TYPES as readonly string[]).includes(v);
export const aiDefault = (t: PageType) => TYPE_INFO[t].ai;

export const MAX = { title: 120, summary: 300, body: 50_000, tags: 10, tag: 30, query: 80 } as const;

/** Slugs that would collide with the Wiki's own pages. */
const RESERVED = new Set(["new", "edit", "history", "build"]);

/** "Sales, Q3 plan,, sales" → ["sales", "q3 plan"]: lower case, no duplicates, short, at most ten. Returns an error for a tag that is too long. */
export function parseTags(raw: string): { ok: true; tags: string[] } | { ok: false; error: string } {
  const out: string[] = [];
  for (const part of raw.split(/[,\n]+/)) {
    const t = part.toLowerCase().replace(/\s+/g, " ").replace(/[<>"\\]/g, "").trim();
    if (!t) continue;
    if (t.length > MAX.tag) return { ok: false, error: `A tag can be up to ${MAX.tag} characters: "${t.slice(0, 20)}…"` };
    if (!out.includes(t)) out.push(t);
  }
  if (out.length > MAX.tags) return { ok: false, error: `Up to ${MAX.tags} tags per page.` };
  return { ok: true, tags: out };
}

/**
 * Looks for what must never be stored here: passwords and keys written out. Returns a message, or null when nothing looks like one.
 * It is a guard against pasting by habit, not a scanner, so it only matches clear shapes.
 */
export function secretHint(text: string): string | null {
  const shapes = [
    /\b(password|passwd|pwd|passcode|secret|api[ _-]?key|access[ _-]?token|auth[ _-]?token)\s*(?:is\s*)?[:=]\s*\S{6,}/i,
    /\bsk-[A-Za-z0-9_-]{20,}/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bgh[pousr]_[A-Za-z0-9]{30,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/,
  ];
  return shapes.some((r) => r.test(text)) ? "This looks like it contains a password or a key. Take it out: the Wiki is not a safe place for secrets. Keep them in Settings or a password manager." : null;
}

export type PageInput = { title: string; summary: string; body: string; type: PageType; tags: string[]; parent_id: string | null; ai_readable: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A page from form fields. `get` returns the text of a field, or "" when it is missing. A checkbox is "on" when ticked and absent when not. */
export function parsePage(get: (key: string) => string): { ok: true; value: PageInput } | { ok: false; error: string } {
  const title = get("title").replace(/\s+/g, " ").trim();
  if (!title) return { ok: false, error: "Give the page a title." };
  if (title.length > MAX.title) return { ok: false, error: `Keep the title under ${MAX.title} characters.` };
  const summary = get("summary").replace(/\s+/g, " ").trim();
  if (summary.length > MAX.summary) return { ok: false, error: `Keep the summary under ${MAX.summary} characters.` };
  const body = get("body").replace(/\r\n?/g, "\n");
  if (body.length > MAX.body) return { ok: false, error: `The page is too long. Keep it under ${MAX.body.toLocaleString("en-US")} characters, or split it into two pages.` };
  const type = get("type") || "other";
  if (!isType(type)) return { ok: false, error: "Pick a type from the list." };
  const tags = parseTags(get("tags"));
  if (!tags.ok) return tags;
  const parent = get("parentId");
  if (parent && !UUID.test(parent)) return { ok: false, error: "Pick a parent page from the list." };
  const secret = secretHint(`${title}\n${summary}\n${body}`);
  if (secret) return { ok: false, error: secret };
  return { ok: true, value: { title, summary, body, type, tags: tags.tags, parent_id: parent || null, ai_readable: get("aiReadable") === "on" } };
}

/** The address of a page, from its title. Never one of the Wiki's own words, never empty. */
export function pageSlug(title: string): string {
  const base = slugify(title).slice(0, 60).replace(/-+$/g, "");
  return !base || RESERVED.has(base) ? `page-${base || "x"}`.slice(0, 60) : base;
}

/** `base`, or `base-2`, `base-3` … the first one that is not in `taken`. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const s = `${base.slice(0, 76)}-${n}`;
    if (!taken.has(s)) return s;
  }
  return `${base.slice(0, 60)}-${Date.now().toString(36)}`;
}

export type Node = { id: string; title: string; slug: string; parent_id: string | null };

/** The pages above this one, from the top of the tree down to its parent. Stops if the data loops. */
export function trail(nodes: readonly Node[], id: string): Node[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: Node[] = [];
  const seen = new Set<string>([id]);
  let cur = byId.get(id)?.parent_id ?? null;
  while (cur && !seen.has(cur)) {
    const n = byId.get(cur);
    if (!n) break;
    out.unshift(n);
    seen.add(cur);
    cur = n.parent_id;
  }
  return out;
}

/** Every page below this one at any depth. A page cannot be moved under itself or under one of these. */
export function descendants(nodes: readonly Node[], id: string): Set<string> {
  const kids = new Map<string, string[]>();
  for (const n of nodes) if (n.parent_id) kids.set(n.parent_id, [...(kids.get(n.parent_id) ?? []), n.id]);
  const out = new Set<string>();
  const stack = [...(kids.get(id) ?? [])];
  while (stack.length) {
    const c = stack.pop()!;
    if (out.has(c)) continue;
    out.add(c);
    stack.push(...(kids.get(c) ?? []));
  }
  return out;
}

/** The pages in tree order, each with its depth, for a "parent" menu. Siblings by title. `skip` leaves out a page and everything under it. */
export function flatten(nodes: readonly Node[], skip?: string): (Node & { depth: number })[] {
  const hidden = skip ? new Set([skip, ...descendants(nodes, skip)]) : new Set<string>();
  const ids = new Set(nodes.map((n) => n.id));
  const kids = new Map<string | null, Node[]>();
  for (const n of nodes) {
    if (hidden.has(n.id)) continue;
    const key = n.parent_id && ids.has(n.parent_id) ? n.parent_id : null;
    kids.set(key, [...(kids.get(key) ?? []), n]);
  }
  const out: (Node & { depth: number })[] = [];
  const walk = (key: string | null, depth: number, guard: Set<string>) => {
    for (const n of (kids.get(key) ?? []).sort((a, b) => a.title.localeCompare(b.title))) {
      if (guard.has(n.id)) continue;
      out.push({ ...n, depth });
      walk(n.id, depth + 1, new Set([...guard, n.id]));
    }
  };
  walk(null, 0, new Set());
  return out;
}
