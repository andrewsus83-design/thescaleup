import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { RoomShell } from "@/components/room/shell";

export const metadata: Metadata = {
  title: "Chat Room",
  description: "Project-bound AI chat room for ScaleUp staff (prototype).",
  robots: { index: false, follow: false },
};

/** Staff only — same gate as /admin. The menu lives on the left (see components/room/shell.tsx). */
export default async function RoomLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <RoomShell email={user.email} role={user.role}>
      {children}
    </RoomShell>
  );
}
