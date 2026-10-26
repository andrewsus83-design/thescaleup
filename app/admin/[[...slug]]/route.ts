import { NextResponse } from "next/server";
import { ROOM_HOME } from "@/lib/admin/landing";

// The old admin dashboard is archived (archive/old-admin-dashboard). Whatever used to live under /admin — a bookmark,
// an old link — now opens the Chat Room. /admin/login, /admin/access and /admin/logout are their own routes and win over
// this catch-all; on the report subdomain proxy.ts maps /admin to /report/admin before a request gets here.
export function GET(request: Request) {
  return NextResponse.redirect(new URL(ROOM_HOME, request.url));
}
