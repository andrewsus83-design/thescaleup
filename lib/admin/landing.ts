// Where an admin lands after logging in. The Chat Room is the home of the staff app (the old admin dashboard is archived,
// see archive/old-admin-dashboard). The report subdomain keeps its own admin: there proxy.ts maps /admin to /report/admin.
// Pure and import-safe from both server and client code.

export const ROOM_HOME = "/room/chat";

export function adminLanding(host?: string | null): string {
  return host?.toLowerCase().startsWith("report.") ? "/admin" : ROOM_HOME;
}
