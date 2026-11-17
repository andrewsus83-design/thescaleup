"use client";

import { usePathname } from "next/navigation";
import { menuFromPath } from "@/lib/hub/menus";

/** Gives everything inside the colour of the menu the person is in (see `[data-acc]` in globals.css). It adds no box of its own. */
export function AccentScope({ children }: { children: React.ReactNode }) {
  const menu = menuFromPath(usePathname()) ?? "home";
  return (
    <div data-acc={menu} className="contents">
      {children}
    </div>
  );
}
