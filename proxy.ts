import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 Proxy (formerly Middleware).
 *
 * Maps the report subdomain onto the /report route tree so that
 *   report.thescaleup.xyz/admin      -> /report/admin
 *   report.thescaleup.xyz/c/<slug>   -> /report/c/<slug>
 * while the main domain keeps serving thescaleup.xyz unchanged.
 *
 * (Add report.thescaleup.xyz as a domain on this Vercel project for the
 * subdomain to reach here; until then the same pages work at /report/*.)
 */
export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  if (!host.startsWith("report.")) return NextResponse.next();

  const { pathname } = request.nextUrl;
  // Shared auth pages + internals serve from the apex app as-is (so login,
  // access-code, logout and Supabase callbacks work on the subdomain and set
  // their session cookies on report.thescaleup.xyz). Everything else maps to
  // the /report route tree.
  if (
    pathname.startsWith("/report") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/auth") ||
    pathname === "/admin/login" ||
    pathname === "/admin/access" ||
    pathname === "/admin/logout"
  ) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? "/report" : `/report${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Run on everything except static assets; host filtering happens above.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
