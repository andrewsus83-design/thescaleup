import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Chip } from "@/components/brand/primitives";
import { cardCls } from "@/components/brand/styles";
import { cn } from "@/lib/utils";

export type SectionItem = { key: string; title: string; hint: string; icon: LucideIcon; href?: string; soon?: boolean };

function Body({ item }: { item: SectionItem }) {
  const Icon = item.icon;
  return (
    <>
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-field bg-paper-100 text-ink-600">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-body font-semibold text-ink-800">{item.title}</span>
          {item.soon && <Chip tone="neutral">Coming next</Chip>}
        </span>
        <span className="block text-small text-ink-500">{item.hint}</span>
      </span>
    </>
  );
}

/** A stack of section cards. With an href it is a link; without one it is a plain card (nothing to open yet). */
export function SectionList({ items }: { items: SectionItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key}>
          {item.href ? (
            <Link href={item.href} className={cn(cardCls(true, true), "flex min-h-16 items-center gap-4")}>
              <Body item={item} />
              <ChevronRight className="size-5 shrink-0 text-ink-400" aria-hidden />
            </Link>
          ) : (
            <div className={cn(cardCls(true), "flex min-h-16 items-center gap-4")}>
              <Body item={item} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
