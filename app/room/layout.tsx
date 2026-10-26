import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { requireAdmin } from "@/lib/admin/auth";
import { RoomShell } from "@/components/room/shell";

// Brand v2 type (BRAND.md §4): Bricolage Grotesque for titles, Instrument Sans for reading. JetBrains Mono for
// commands, numbers and caps labels is already loaded by the root layout (--font-jbmono). Both fonts are scoped
// to this layout, so the rest of the site doesn't download them.
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz"], variable: "--font-bricolage", display: "swap" });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", display: "swap" });

export const metadata: Metadata = {
  title: "Chat Room",
  description: "Project-bound AI chat room for ScaleUp staff (prototype).",
  robots: { index: false, follow: false },
};

/** Staff only — same gate as /admin. The menu lives on the left (see components/room/shell.tsx). */
export default async function RoomLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className={`${bricolage.variable} ${instrument.variable}`}>
      <RoomShell email={user.email} role={user.role}>
        {children}
      </RoomShell>
    </div>
  );
}
