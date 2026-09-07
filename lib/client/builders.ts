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

export type Builder = {
  slug: string;
  title: string;
  tagline: string;
  icon: LucideIcon;
  features: string[];
};

export const BUILDERS: Builder[] = [
  {
    slug: "website",
    title: "Website Builder",
    tagline: "Website, analytic & fix-it",
    icon: Globe,
    features: [
      "Audit & rebuild landing page / website",
      "Analytics: traffic, konversi, funnel",
      "Perbaikan on-page SEO & CRO (fix-it)",
    ],
  },
  {
    slug: "store",
    title: "Online Store & Integrasi",
    tagline: "Toko online, WhatsApp & produk",
    icon: ShoppingBag,
    features: [
      "Integrasi toko online / e-commerce",
      "WhatsApp funnel, katalog & auto-reply",
      "Sinkronisasi produk web ↔ toko ↔ WA",
    ],
  },
  {
    slug: "content",
    title: "Content Builder",
    tagline: "Blog & social media",
    icon: PenSquare,
    features: [
      "Kalender konten 30 hari",
      "Artikel blog SEO / GEO",
      "Konten & caption social media",
    ],
  },
  {
    slug: "ads",
    title: "Ads & Campaign",
    tagline: "Manajemen iklan & kampanye",
    icon: Megaphone,
    features: [
      "Setup & manajemen ads (Meta / Google / TikTok)",
      "Optimasi kampanye & audiens",
      "Laporan ROAS & performa",
    ],
  },
  {
    slug: "opportunity",
    title: "Opportunity Finder",
    tagline: "Temukan & bangun peluang bisnis",
    icon: Compass,
    features: [
      "Riset pasar & peluang baru",
      "Ide produk / penawaran (offer) baru",
      "Analisis kompetitor & celah pasar",
    ],
  },
  {
    slug: "crm",
    title: "CRM Builder",
    tagline: "Kelola pelanggan & leads",
    icon: Users2,
    features: [
      "Database pelanggan & leads",
      "Pipeline follow-up & closing",
      "Otomatisasi retensi & repeat order",
    ],
  },
  {
    slug: "tasks",
    title: "Task Management",
    tagline: "Manajemen tugas & tim",
    icon: ListChecks,
    features: [
      "Board tugas tim & SOP",
      "Tracking progress & tenggat",
      "Checklist eksekusi harian",
    ],
  },
];

export function getBuilder(slug: string): Builder | undefined {
  return BUILDERS.find((b) => b.slug === slug);
}
