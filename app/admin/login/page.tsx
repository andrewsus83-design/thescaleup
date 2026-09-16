import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin/auth";
import { isAccessEnabled } from "@/lib/admin/access";
import { AdminLoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = {
  title: "Admin Login",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const user = await getAdminUser();
  if (user) redirect("/admin");

  // Email-OTP is the primary login for the admins; the shared access code
  // (if configured) stays available as a fallback link inside the form.
  return <AdminLoginForm codeFallback={isAccessEnabled()} />;
}
