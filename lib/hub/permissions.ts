import type { Actor, BrandRole } from "./rules";

// What each role can open and change in a brand. Pure rules: no I/O, so they are easy to test.
// Founders and the agency always have full access. The other roles start from DEFAULTS and the founder (or the agency)
// changes them per role and per function in Settings → Team. Only the changes are stored.

export const LEVELS = ["none", "view", "edit"] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_LABEL: Record<Level, string> = { none: "No access", view: "Can view", edit: "Can edit" };

export const FUNCTIONS = ["brand", "tasks", "inbox", "mail", "social", "content", "assets", "team", "payroll", "finance", "products"] as const;
export type Fn = (typeof FUNCTIONS)[number];

export const FUNCTION_INFO: Record<Fn, { label: string; hint: string }> = {
  brand: { label: "Brand", hint: "Chronicle, health, tips and updates" },
  tasks: { label: "Tasks", hint: "Lists, board and calendar of the brand's work" },
  inbox: { label: "Inbox", hint: "Email, social comments and DMs, WhatsApp" },
  mail: { label: "Mail", hint: "Email only: read, reply and send from the brand's addresses" },
  social: { label: "Social Media", hint: "Analytics for the connected accounts" },
  content: { label: "Content", hint: "Plan, write and calendar the posts, emails and ads" },
  assets: { label: "Assets", hint: "Graphics, logos and the design system" },
  team: { label: "Team", hint: "Team tasks, clock in and out, KPI, calendar" },
  payroll: { label: "Salary and payroll", hint: "Sensitive: pay and payslips" },
  finance: { label: "Finance", hint: "Accounting and management" },
  products: { label: "Products", hint: "What the brand sells: SKU, price, stock" },
};

/** The roles whose access can be changed. The founder is always full, so there is nothing to set. */
export const CONFIGURABLE_ROLES = ["staff", "ops", "viewer"] as const;
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];

export function isConfigurableRole(v: unknown): v is ConfigurableRole {
  return typeof v === "string" && (CONFIGURABLE_ROLES as readonly string[]).includes(v);
}
export const isFn = (v: unknown): v is Fn => typeof v === "string" && (FUNCTIONS as readonly string[]).includes(v);
export const isLevel = (v: unknown): v is Level => typeof v === "string" && (LEVELS as readonly string[]).includes(v);

export type Access = Record<Fn, Level>;

export const DEFAULTS: Record<ConfigurableRole, Access> = {
  staff: { brand: "edit", tasks: "edit", inbox: "edit", mail: "edit", social: "edit", content: "edit", assets: "edit", team: "view", payroll: "none", finance: "none", products: "edit" },
  ops: { brand: "view", tasks: "edit", inbox: "edit", mail: "edit", social: "view", content: "view", assets: "edit", team: "view", payroll: "none", finance: "none", products: "view" },
  viewer: { brand: "view", tasks: "view", inbox: "none", mail: "none", social: "view", content: "none", assets: "view", team: "none", payroll: "none", finance: "none", products: "view" },
};

export const FULL: Access = Object.fromEntries(FUNCTIONS.map((f) => [f, "edit"])) as Access;

export type Overrides = Partial<Record<Fn, Level>>;

/** The access of one role: the defaults, with the stored changes on top. Unknown functions or levels are ignored. */
export function resolveAccess(actor: Actor | null, overrides: Overrides = {}): Access {
  if (actor === "owner" || actor === "founder") return { ...FULL };
  if (!isConfigurableRole(actor)) return Object.fromEntries(FUNCTIONS.map((f) => [f, "none"])) as Access;
  const out: Access = { ...DEFAULTS[actor] };
  for (const f of FUNCTIONS) {
    const o = overrides[f];
    if (isLevel(o)) out[f] = o;
  }
  return out;
}

const RANK: Record<Level, number> = { none: 0, view: 1, edit: 2 };
export const atLeast = (have: Level, need: Level) => RANK[have] >= RANK[need];

/** Who may change a role's access: the agency for every configurable role; a founder for the roles they could invite. */
export function canEditRole(actor: Actor | null, role: BrandRole): role is ConfigurableRole {
  if (!isConfigurableRole(role)) return false;
  if (actor === "owner") return true;
  if (actor === "founder") return role === "ops" || role === "viewer";
  return false;
}

/** The roles an actor can edit, in display order. */
export const editableRoles = (actor: Actor | null): ConfigurableRole[] => CONFIGURABLE_ROLES.filter((r) => canEditRole(actor, r));

/** Reads one role's levels out of submitted form data (fields named "fn:<function>"). Returns null when anything is invalid. */
export function parseLevels(get: (name: string) => string | null): Access | null {
  const out = {} as Access;
  for (const f of FUNCTIONS) {
    const v = get(`fn:${f}`);
    if (!isLevel(v)) return null;
    out[f] = v;
  }
  return out;
}
