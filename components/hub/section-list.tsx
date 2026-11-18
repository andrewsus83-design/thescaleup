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
      <span className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-full", item.href ? "bg-(--acc-tint) text-(--acc-ink)" : "bg-paper-100 text-ink-600")}>
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

/**
 * Section cards in a grid that uses the page's width: one column on a phone, two on a tablet, three on a wide screen.
 * With an href a card is a link, in the menu's colour; without one it is a plain, quiet card (nothing to open yet).
 */
export function SectionList({ items, twoAtMost }: { items: SectionItem[]; /** For a list that sits in the main column beside a side column. */ twoAtMost?: boolean }) {
  return (
    <ul className={cn("grid grid-cols-1 gap-3 md:grid-cols-2", !twoAtMost && "xl:grid-cols-3")}>
      {items.map((item) => (
        <li key={item.key} className="min-w-0">
          {item.href ? (
            <Link href={item.href} className={cn(cardCls(true, true), "flex h-full min-h-16 items-center gap-4")}>
              <Body item={item} />
              <ChevronRight className="size-5 shrink-0 text-ink-400" aria-hidden />
            </Link>
          ) : (
            <div className={cn(cardCls(true), "flex h-full min-h-16 items-center gap-4")}>
              <Body item={item} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
