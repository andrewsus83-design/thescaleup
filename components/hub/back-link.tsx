import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="hit-44 -ml-2 mb-4 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-small font-semibold text-ink-500 hover:text-ink-800">
      <ChevronLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}
