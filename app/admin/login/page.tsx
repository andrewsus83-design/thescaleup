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

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const user = await getAdminUser();
  if (user) redirect("/admin");
  const { e } = await searchParams;
  const err = e === "2" ? "Email tidak terdaftar untuk kode ini." : e === "1" ? "Isi email + kode akses yang benar." : undefined;

  // Email-OTP is the primary login for the admins; the shared access code
  // (email + code) stays available as a fallback inside the form.
  return <AdminLoginForm codeFallback={isAccessEnabled()} initialError={err} />;
}
