import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { bricolage, instrument } from "@/lib/brand-fonts";
import { RoomShell } from "@/components/room/shell";

export const metadata: Metadata = {
  title: "Chat Room",
  description: "Project-bound AI chat room for ScaleUp staff (prototype).",
  robots: { index: false, follow: false },
};

/** Staff only (the admin gate). This is where admins land after login; the menu lives on the left (see components/room/shell.tsx). */
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
