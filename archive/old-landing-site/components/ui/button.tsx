import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "group inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/60 focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap cursor-pointer";

const variants: Record<Variant, string> = {
  primary:
    "text-white bg-gradient-to-br from-coral-soft via-coral to-sunset glow-coral hover:brightness-110 hover:-translate-y-0.5",
  secondary:
    "text-mist bg-card/50 border border-coral/25 hover:border-coral/60 hover:bg-card backdrop-blur-sm",
  ghost: "text-slate-300 hover:text-white hover:bg-white/5",
};

const sizes: Record<Size, string> = {
  sm: "text-sm px-4 h-9",
  md: "text-[0.95rem] px-5 h-11",
  lg: "text-base px-7 h-14",
};

type ButtonProps = {
  href?: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLElement>;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
};

export function Button({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  onClick,
  type = "button",
  disabled,
}: ButtonProps) {
  const cls = cn(base, variants[variant], sizes[size], className);

  if (href) {
    if (href.startsWith("http")) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={onClick}
          className={cls}
        >
          {children}
        </a>
      );
    }
    return (
      <Link href={href} onClick={onClick} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}
