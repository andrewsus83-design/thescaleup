import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { btnCls } from "@/components/brand/styles";

/**
 * The top of a standalone report page: a back link, then the title block. `lead` is the mark on the left (an avatar or an icon
 * tile), `trailing` sits on the right (a status chip). Title in Title, subtitle in Body: BRAND §4.
 */
export function ReportPageHead({
  back,
  title,
  description,
  lead,
  trailing,
}: {
  back: { href: string; label: string };
  title: string;
  description?: React.ReactNode;
  lead?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <Link href={back.href} className={btnCls("ghost", "sm", "-ml-5 mb-2 gap-2")}>
        <ArrowLeft className="size-4" aria-hidden /> {back.label}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-4">
          {lead}
          <div className="min-w-0">
            <h1 className="truncate font-title text-h2 text-ink-800">{title}</h1>
            {description && <p className="text-small text-ink-500">{description}</p>}
          </div>
        </div>
        {trailing}
      </div>
    </div>
  );
}

/** A 44px Ink tile with an icon in Paper: the mark of a settings page. */
export function IconTile({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-nav bg-ink-800 text-paper-100">{children}</span>;
}
