import { cn } from "@/lib/utils";

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-coral/25 bg-coral/10 px-3.5 py-1.5 text-xs font-medium text-coral-soft",
        className,
      )}
    >
      {children}
    </span>
  );
}
