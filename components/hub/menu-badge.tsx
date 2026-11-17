"use client";

import { usePathname } from "next/navigation";
import { menuFromPath } from "@/lib/hub/menus";
import { MENU } from "./menus";

/** The round icon in the menu's colour that sits beside a page title. Renders nothing outside a brand's menus. */
export function MenuBadge() {
  const menu = menuFromPath(usePathname());
  if (!menu || menu === "home") return null;
  const Icon = MENU[menu].icon;
  return (
    <span aria-hidden className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-(--acc-tint) text-(--acc-ink)">
      <Icon className="size-6" />
    </span>
  );
}
