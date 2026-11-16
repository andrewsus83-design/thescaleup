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

const COMMON_PASSWORDS = new Set(["password12", "password123", "1234567890", "12345678910", "qwertyuiop", "1q2w3e4r5t", "iloveyou12", "welcome123", "admin12345", "letmein1234"]);

/** Returns an error message, or null when the password is acceptable. bcrypt only reads the first 72 bytes, so longer is refused. */
export function passwordError(pw: string, email: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (new TextEncoder().encode(pw).length > 72) return "Use at most 72 characters.";
  if (/^(.)\1+$/.test(pw)) return "Choose something less repetitive.";
  const lower = pw.toLowerCase();
  if (COMMON_PASSWORDS.has(lower) || lower === email.toLowerCase() || lower === email.split("@")[0]?.toLowerCase()) return "That password is too easy to guess.";
  return null;
}

/** The six digits from a box where people paste "123 456" or "123-456". Null when it is not six digits. */
export function cleanCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}
