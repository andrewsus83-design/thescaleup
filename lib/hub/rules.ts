// Pure rules for brand roles and invites. No I/O, so they are easy to test.

export const BRAND_ROLES = ["founder", "staff", "ops", "viewer"] as const;
export type BrandRole = (typeof BRAND_ROLES)[number];

/** What the signed-in person is for this brand: a platform owner (agency) or one of the brand roles. */
export type Actor = "owner" | BrandRole;

export const ROLE_LABEL: Record<BrandRole, string> = {
  founder: "Founder",
  staff: "Agency staff",
  ops: "Ops",
  viewer: "Viewer",
};

export function isBrandRole(v: unknown): v is BrandRole {
  return typeof v === "string" && (BRAND_ROLES as readonly string[]).includes(v);
}

/** Roles an actor may hand out when inviting. Founders invite their own team; only the agency invites founders and staff. */
export function invitableRoles(actor: Actor | null): BrandRole[] {
  if (actor === "owner") return ["founder", "staff", "ops", "viewer"];
  if (actor === "founder") return ["ops", "viewer"];
  return [];
}

export function canInvite(actor: Actor | null, role: BrandRole): boolean {
  return invitableRoles(actor).includes(role);
}

/** Founders and the agency can see and manage the team list. */
export function canManageTeam(actor: Actor | null): boolean {
  return actor === "owner" || actor === "founder";
}

/** A member may be removed by someone who could have invited that role. Nobody removes themselves here. */
export function canRemove(actor: Actor | null, target: BrandRole, isSelf: boolean): boolean {
  if (isSelf) return false;
  return canInvite(actor, target);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

export function isEmail(v: string): boolean {
  return v.length <= 254 && EMAIL_RE.test(v);
}

/** Only allow sending people back to a path inside the hub. */
export function safeNext(v: unknown, fallback = "/hub"): string {
  if (typeof v !== "string") return fallback;
  if (!v.startsWith("/hub")) return fallback;
  if (v.startsWith("/hub//") || v.includes("\\") || v.includes("://") || /[\r\n]/.test(v)) return fallback;
  if (v !== "/hub" && !v.startsWith("/hub/") && !v.startsWith("/hub?")) return fallback;
  return v;
}
