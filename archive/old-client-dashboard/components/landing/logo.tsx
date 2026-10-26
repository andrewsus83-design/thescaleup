import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative inline-flex h-9 w-9 items-center justify-center">
        <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden="true">
          <defs>
            <linearGradient id="lg-mark" x1="0" y1="40" x2="40" y2="0">
              <stop offset="0" stopColor="#E03E1A" />
              <stop offset="0.5" stopColor="#FF5733" />
              <stop offset="1" stopColor="#FF9A3D" />
            </linearGradient>
          </defs>
          <rect
            x="1.5"
            y="1.5"
            width="37"
            height="37"
            rx="11"
            fill="url(#lg-mark)"
            opacity="0.16"
          />
          <rect
            x="1.5"
            y="1.5"
            width="37"
            height="37"
            rx="11"
            fill="none"
            stroke="url(#lg-mark)"
            strokeWidth="1.5"
            opacity="0.5"
          />
          {/* ascending bars */}
          <rect x="11" y="23" width="4.5" height="7" rx="1.6" fill="url(#lg-mark)" />
          <rect x="17.75" y="18" width="4.5" height="12" rx="1.6" fill="url(#lg-mark)" />
          <rect x="24.5" y="12" width="4.5" height="18" rx="1.6" fill="url(#lg-mark)" />
          {/* rising arrow */}
          <path
            d="M11 20.5 L19 15 L24.5 17.5 L30.5 9"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M27 9 L30.5 9 L30.5 12.5"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {showWordmark && (
        <span className="font-display text-lg font-extrabold tracking-tight text-mist">
          {site.wordmark}
        </span>
      )}
    </span>
  );
}
