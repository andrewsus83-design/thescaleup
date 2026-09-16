import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ScaleUp Reports",
  description: "Dashboard laporan performa sosial per klien — ScaleUp.",
  robots: { index: false, follow: false },
};

/**
 * The report platform (report.thescaleup.xyz) uses its own light theme,
 * independent of the dark marketing site. A solid light full-bleed wrapper
 * covers the root dark body/background.
 */
export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 min-h-screen w-full bg-[#F4F5FB] text-[#1B2A4A]">
      {children}
    </div>
  );
}
