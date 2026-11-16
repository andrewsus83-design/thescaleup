// Brand slugs become subdomains, so they follow DNS label rules. Mirrors the CHECK constraints in
// supabase/migrations/20261116130000_brand_foundation.sql; the database stays the last line of defence.

export const RESERVED_SLUGS = new Set([
  "www", "app", "admin", "api", "report", "staging", "mail", "email", "smtp", "ftp", "dev", "test",
  "static", "assets", "cdn", "docs", "help", "support", "status", "blog", "billing", "dashboard",
  "login", "auth", "room", "hub", "scaleup", "thescaleup",
]);

export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** Returns an error message, or null when the slug is fine. */
export function slugError(slug: string): string | null {
  if (slug.length < 3 || slug.length > 40) return "Use 3 to 40 characters.";
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) return "Use lowercase letters, numbers and hyphens; start and end with a letter or number.";
  if (slug.includes("--")) return "No double hyphens.";
  if (RESERVED_SLUGS.has(slug)) return "That name is reserved.";
  return null;
}
