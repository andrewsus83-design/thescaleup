import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const res = NextResponse.redirect(new URL("/admin/login", request.url));
  res.cookies.set("sc_admin_access", "", { path: "/", maxAge: 0 });
  return res;
}
