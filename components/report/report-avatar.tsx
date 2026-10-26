import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A brand's mark in the report: its initials on an Ink circle (Paper text), or the stacked-layers icon for a combined view.
 * It replaces the tile that used to be filled with the client's own colour: the report wears the ScaleUp brand system,
 * so the colour is a token, not data. (BRAND "Chat": an avatar is a circle.)
 */
export function ReportAvatar({ name, combined, size = "md", className }: { name: string; combined?: boolean; size?: "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-ink-800 font-title font-extrabold uppercase text-paper-100",
        size === "lg" ? "size-14 text-h3" : "size-11 text-small",
        className,
      )}
    >
      {combined ? <Layers className="size-5" aria-hidden /> : name.slice(0, 2)}
    </span>
  );
}
