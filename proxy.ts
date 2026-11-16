import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
export async function proxy(request: NextRequest) {
  // Brand app: keep the Supabase session fresh. Server Components cannot write cookies, so without this the
  // access token would lapse after an hour and the person would be signed out. Only /hub pays this cost.
  if (request.nextUrl.pathname === "/hub" || request.nextUrl.pathname.startsWith("/hub/")) {
    return refreshSupabaseSession(request);
  }

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

async function refreshSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // getClaims() refreshes an expired session and checks a valid token locally, so most requests make no call to Supabase Auth
  // here (getUser() made one on every request). The result is not used: pages and actions still call getUser() themselves.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Run on everything except static assets; host filtering happens above.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
