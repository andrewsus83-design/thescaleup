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
  {
    slug: "support",
    title: "Customer Support Builder",
    tagline: "Layanan pelanggan & retensi",
    features: [
      "Channel support (WA / email / live chat)",
      "Knowledge base, FAQ & canned response",
      "Chatbot, ticketing & SLA respon",
    ],
  },
  {
    slug: "booking",
    title: "Booking System Builder",
    tagline: "Reservasi & jadwal online",
    features: [
      "Booking online + kalender slot real-time",
      "Konfirmasi & reminder otomatis (WA/email)",
      "Kelola staff, kapasitas & no-show",
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

/**
 * Concrete deliverable tasks per builder — what ScaleUp actually does for the
 * client. Used to (1) seed Master Plan items, and (2) populate the invoice
 * Scope of Work. More specific than `features` (which is marketing copy).
 */
export const BUILDER_TASKS: Record<string, string[]> = {
  website: [
    "Audit UX/CRO & struktur website saat ini",
    "Desain ulang + build landing page/website high-converting",
    "Setup analytics (traffic, funnel, event konversi)",
    "Optimasi teknis SEO on-page + schema markup",
    "Optimasi GEO/AI-Search + social meta (OG/Twitter cards)",
    "Handover + walkthrough cara update konten",
  ],
  store: [
    "Setup toko online / integrasi e-commerce",
    "Katalog produk + WhatsApp checkout & auto-reply",
    "Sinkronisasi produk web ↔ toko ↔ WhatsApp",
    "Setup payment gateway & ongkir low-fee",
    "Optimasi halaman produk untuk konversi",
  ],
  content: [
    "Riset audiens + kalender konten 30 hari",
    "Produksi artikel blog SEO/GEO",
    "Produksi konten & caption social media",
    "Alur approval konten + jadwal publish",
    "Report performa konten bulanan",
  ],
  ads: [
    "Riset audiens & struktur kampanye",
    "Setup pixel/tracking & event konversi",
    "Produksi materi iklan (copy + creative brief)",
    "Peluncuran & optimasi kampanye (Meta/Google/TikTok)",
    "Report ROAS & rekomendasi scaling",
  ],
  opportunity: [
    "Riset pasar & analisis kompetitor",
    "Identifikasi celah pasar & peluang baru",
    "Rancang offer/produk baru + validasi",
    "Rekomendasi kanal & go-to-market",
  ],
  crm: [
    "Rancang pipeline penjualan sesuai bisnis",
    "Setup database kontak + import data",
    "Integrasi channel (WA/IG/marketplace) ke pipeline",
    "Setup otomatisasi follow-up & retensi",
    "Dashboard konversi, LTV & repeat rate",
  ],
  tasks: [
    "Setup board tugas tim + SOP/Definition of Done",
    "Input tugas awal + assign PIC, prioritas, tenggat",
    "Setup otomatisasi reminder & notifikasi",
    "Dashboard beban tim & laju penyelesaian",
    "Laporan progres berkala",
  ],
  support: [
    "Setup channel customer support (WA/email/live chat)",
    "Bangun knowledge base + FAQ + canned response",
    "Setup auto-reply/chatbot & ticketing + SLA",
    "Alur eskalasi & routing ke tim",
    "Dashboard CSAT, response time & resolusi",
  ],
  booking: [
    "Setup layanan, durasi & kapasitas slot",
    "Halaman booking online + form reservasi",
    "Integrasi kalender & ketersediaan staff",
    "Otomatisasi konfirmasi + reminder (WA/email)",
    "Kebijakan DP/pembayaran & reschedule",
    "Dashboard okupansi, no-show & report",
  ],
};

export function builderTasks(slug: string): string[] {
  return BUILDER_TASKS[slug] ?? builderDef(slug)?.features ?? [];
}
