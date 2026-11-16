import Link from "next/link";
import { Chip } from "@/components/brand/primitives";
import { pillCls } from "@/components/brand/styles";
import { TYPE_INFO, type Node, type PageType } from "@/lib/hub/wiki/model";

export const wikiBase = (slug: string) => `/hub/b/${slug}/wiki`;

export function TypeChip({ type }: { type: PageType }) {
  return <Chip>{TYPE_INFO[type].label}</Chip>;
}

/** Shown only when AI features are kept away from the page: the usual case needs no label. */
export function HiddenFromAi() {
  return <Chip tone="warn">Hidden from AI</Chip>;
}

export function TagLinks({ slug, tags }: { slug: string; tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Tags">
      {tags.map((t) => (
        <li key={t}>
          <Link href={`${wikiBase(slug)}?tag=${encodeURIComponent(t)}`} className={pillCls(false)}>
            {t}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Wiki / Parent / Parent: where this page sits. */
export function Crumbs({ slug, trail }: { slug: string; trail: Node[] }) {
  return (
    <nav aria-label="Where this page sits" className="mb-3">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-ink-500">
        <li>
          <Link href={wikiBase(slug)} className="font-semibold text-brand-700 underline underline-offset-4">
            Wiki
          </Link>
        </li>
        {trail.map((n) => (
          <li key={n.id} className="flex items-center gap-2">
            <span aria-hidden>/</span>
            <Link href={`${wikiBase(slug)}/${n.slug}`} className="font-semibold text-brand-700 underline underline-offset-4">
              {n.title}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** "Priya" from "priya@brand.com", or "Someone" when the person is no longer on the team. */
export function whoIs(members: { userId: string; email: string }[], id: string | null): string {
  const m = id ? members.find((x) => x.userId === id) : undefined;
  return m ? m.email.split("@")[0] : "Someone";
}
