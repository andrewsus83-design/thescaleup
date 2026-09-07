import {
  Globe,
  ShoppingBag,
  PenSquare,
  Megaphone,
  Compass,
  Users2,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { BUILDER_DEFS, type BuilderDef } from "@/lib/builders";

export type Builder = BuilderDef & { icon: LucideIcon };

const ICONS: Record<string, LucideIcon> = {
  website: Globe,
  store: ShoppingBag,
  content: PenSquare,
  ads: Megaphone,
  opportunity: Compass,
  crm: Users2,
  tasks: ListChecks,
};

export const BUILDERS: Builder[] = BUILDER_DEFS.map((b) => ({
  ...b,
  icon: ICONS[b.slug] ?? Globe,
}));

export function getBuilder(slug: string): Builder | undefined {
  return BUILDERS.find((b) => b.slug === slug);
}
