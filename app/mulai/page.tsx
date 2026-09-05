import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "Mulai Audit Bisnis Anda",
  description:
    "Isi 5 langkah singkat dan tim ScaleUp akan menyiapkan audit bisnis Anda.",
};

export default function MulaiPage() {
  return <OnboardingFlow />;
}
