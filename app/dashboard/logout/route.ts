import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL("/dashboard/login", request.url));
  res.cookies.set("sc_client", "", { path: "/", maxAge: 0 });
  return res;
}
