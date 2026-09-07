// Plain builder definitions (no icons) — safe to import in server actions.
export type BuilderDef = {
  slug: string;
  title: string;
  tagline: string;
  features: string[];
};

export const BUILDER_DEFS: BuilderDef[] = [
  {
    slug: "website",
    title: "Website Builder",
    tagline: "Website, analytic & fix-it",
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
    features: [
      "Board tugas tim & SOP",
      "Tracking progress & tenggat",
      "Checklist eksekusi harian",
    ],
  },
];

export const BUILDER_SLUGS = BUILDER_DEFS.map((b) => b.slug);

export function builderDef(slug: string) {
  return BUILDER_DEFS.find((b) => b.slug === slug);
}

export function builderTitle(slug: string) {
  return builderDef(slug)?.title ?? slug;
}
