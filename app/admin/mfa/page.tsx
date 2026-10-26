import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminLanding } from "@/lib/admin/landing";
import { MfaEnroll } from "@/components/admin/mfa-enroll";
import { MfaVerify } from "@/components/admin/mfa-verify";

export const metadata: Metadata = {
  title: "Verifikasi MFA",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MfaPage() {
  const supabase = await createSupabaseServerClient();

  // Must have a Supabase session to reach here.
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/admin/login");

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  // Already at AAL2 — go straight to admin.
  if (aalData?.currentLevel === "aal2") {
    redirect(adminLanding(undefined));
  }

  // Check if user already has a TOTP factor enrolled.
  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const totpFactor = factorsData?.totp?.find((f) => f.status === "verified");

  if (totpFactor) {
    // Factor exists, needs verification to reach AAL2.
    return <MfaVerify factorId={totpFactor.id} />;
  }

  // No factor yet — enroll.
  return <MfaEnroll />;
}
