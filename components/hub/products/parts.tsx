import Link from "next/link";
import { Chip } from "@/components/brand/primitives";
import { segItem, segWrap } from "@/components/brand/styles";
import { KIND_LABEL, type StockState, type StoreKind } from "@/lib/hub/products/model";

export const productsBase = (slug: string) => `/hub/b/${slug}/products`;

const SECTIONS = [
  { id: "catalog", label: "Catalog", path: "", edit: false },
  { id: "stores", label: "Stores", path: "/stores", edit: false },
  { id: "import", label: "Import", path: "/import", edit: true },
] as const;
export type Section = (typeof SECTIONS)[number]["id"];

export function ProductsNav({ slug, active, canEdit }: { slug: string; active: Section; canEdit: boolean }) {
  return (
    <nav aria-label="Products sections" className={`${segWrap} mb-6`}>
      {SECTIONS.filter((s) => canEdit || !s.edit).map((s) => (
        <Link key={s.id} href={`${productsBase(slug)}${s.path}`} aria-current={active === s.id ? "page" : undefined} className={segItem(active === s.id)}>
          {s.label}
        </Link>
      ))}
    </nav>
  );
}

export function StockChip({ state }: { state: StockState }) {
  if (state === "out") return <Chip tone="bad">Out of stock</Chip>;
  if (state === "low") return <Chip tone="warn">Low</Chip>;
  return null;
}

export function KindChip({ kind }: { kind: StoreKind }) {
  return <Chip tone="neutral">{KIND_LABEL[kind]}</Chip>;
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption text-ink-500">{label}</dt>
      <dd className="mt-0.5 font-mono text-h3 font-medium text-ink-800">{value}</dd>
    </div>
  );
}

/** "3 days ago"-style text for when a store was last imported. */
export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return "never";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "never";
  const mins = Math.max(0, Math.round((now - t) / 60000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 36) return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}
