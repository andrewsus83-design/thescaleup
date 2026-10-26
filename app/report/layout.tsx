import type { Metadata } from "next";
import { bricolage, instrument } from "@/lib/brand-fonts";

export const metadata: Metadata = {
  title: "ScaleUp Reports",
  description: "Dashboard laporan performa sosial per klien — ScaleUp.",
  robots: { index: false, follow: false },
};

/**
 * The report platform (report.thescaleup.xyz) wears the brand design system (BRAND.md v2.0): Paper surface, Ink text,
 * Bricolage / Instrument Sans / JetBrains Mono. `.brand-app` brings the light colour scheme, the keyboard focus ring and the
 * scrollbar (app/globals.css); a solid full-bleed wrapper covers the dark body of the root layout.
 */
export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${bricolage.variable} ${instrument.variable}`}>
      <div className="brand-app relative z-10 min-h-screen w-full bg-paper-100 font-text text-body text-ink-800 antialiased">{children}</div>
    </div>
  );
}
