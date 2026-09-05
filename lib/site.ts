import {
  Search,
  Bot,
  HeartHandshake,
  Cpu,
  Megaphone,
  TrendingUp,
  Terminal,
  PenTool,
  ShieldCheck,
  ClipboardList,
  Radar,
  Brain,
  FileCheck2,
  type LucideIcon,
} from "lucide-react";

export const site = {
  name: "ScaleUp",
  wordmark: "ScaleUp",
  url: "https://thescaleup.id",
  tagline: "Dewan Direksi AI untuk Scale-Up Bisnis Anda",
  description:
    "Masukkan 8 info bisnis Anda. Dalam hitungan menit, dewan AI kami — CMO, CBO, CTO — membedah website, sosial media, dan posisi Anda di AI Search, lalu menyerahkan skor kesehatan bisnis, kebocoran omzet, dan roadmap scale-up yang siap dieksekusi.",
  email: "halo@thescaleup.id",
  price: {
    label: "Mulai dari",
    amount: "Rp 299.000",
    unit: "/ audit",
  },
} as const;

export const nav = [
  { label: "Cara Kerja", href: "/cara-kerja" },
  { label: "Executive Board", href: "/executive-board" },
  { label: "Harga", href: "/#harga" },
  { label: "Blog", href: "/blog" },
  { label: "FAQ", href: "/faq" },
] as const;

export type Pillar = {
  key: string;
  title: string;
  score: number;
  icon: LucideIcon;
  desc: string;
};

export const pillars: Pillar[] = [
  {
    key: "cro",
    title: "CRO & Landing Page",
    score: 45,
    icon: Search,
    desc: "Seberapa efektif website Anda mengubah pengunjung jadi pembeli — headline, CTA, trust signal, dan friction di checkout.",
  },
  {
    key: "geo",
    title: "GEO / AI Search",
    score: 25,
    icon: Bot,
    desc: "Apakah brand Anda direkomendasikan ChatGPT, Perplexity & Gemini saat calon pembeli mencari solusi di kategori Anda.",
  },
  {
    key: "social",
    title: "Social Engagement",
    score: 70,
    icon: HeartHandshake,
    desc: "Kualitas konten & engagement sosial media Anda dibanding kompetitor — pola konten yang benar-benar menghasilkan.",
  },
  {
    key: "tech",
    title: "Tech & Automation",
    score: 40,
    icon: Cpu,
    desc: "Kesiapan infrastruktur: otomatisasi follow-up, CRM, integrasi WhatsApp, dan sistem yang menahan pertumbuhan.",
  },
];

export type BoardMember = {
  role: string;
  title: string;
  icon: LucideIcon;
  summary: string;
  delivers: string[];
};

export const board: BoardMember[] = [
  {
    role: "CMO",
    title: "Chief Marketing Officer",
    icon: Megaphone,
    summary:
      "Akuisisi, positioning GEO/SEO, dan narasi brand. Menemukan dari mana traffic & pembeli baru seharusnya datang.",
    delivers: [
      "GEO / AI Search visibility assessment",
      "Kalender konten 30 hari + hook siap pakai",
      "Analisis engagement & angle konten pemenang",
    ],
  },
  {
    role: "CBO",
    title: "Chief Business Officer",
    icon: TrendingUp,
    summary:
      "Unit economics, struktur penawaran, dan margin. Membongkar kebocoran omzet dan menaikkan Average Order Value.",
    delivers: [
      "Restrukturisasi offer jadi 3 tier (AOV +65%)",
      "Simulasi revenue booster & unit economics",
      "Blueprint affiliate / reseller & recurring revenue",
    ],
  },
  {
    role: "CTO",
    title: "Chief Technology Officer",
    icon: Terminal,
    summary:
      "Arsitektur sistem & otomatisasi. Merancang custom software dan workflow yang menghapus pekerjaan manual.",
    delivers: [
      "Spesifikasi custom software & system flow",
      "Workflow otomatisasi siap import (n8n / Zernio)",
      "Audit API health & integrasi WhatsApp",
    ],
  },
  {
    role: "Creative",
    title: "Creative & Copywriting Lead",
    icon: PenTool,
    summary:
      "Mengubah strategi jadi aset. Wireframe landing page baru dan copywriting yang benar-benar berkonversi.",
    delivers: [
      "Wireframe landing page high-converting",
      "Draft ad copy Meta / Google Ads",
      "Script video Reels / TikTok (hook–body–CTA)",
    ],
  },
];

export const redTeam = {
  role: "Red Team Verifier",
  icon: ShieldCheck,
  summary:
    "Sebelum report keluar, agent independen memverifikasi setiap angka & rekomendasi — menghapus halusinasi dan proyeksi yang tidak realistis.",
};

export type Step = {
  n: string;
  title: string;
  icon: LucideIcon;
  desc: string;
};

export const steps: Step[] = [
  {
    n: "01",
    title: "Isi 8 Info Bisnis",
    icon: ClipboardList,
    desc: "Website, handle sosial media, kompetitor utama, dan beberapa pertanyaan soal kategori, goal, dan bottleneck. Kurang dari 2 menit.",
  },
  {
    n: "02",
    title: "Mesin Multi-API Bekerja",
    icon: Radar,
    desc: "Firecrawl & Apify membedah web + sosial media Anda dan kompetitor. Perplexity mengecek posisi Anda di AI Search secara real-time.",
  },
  {
    n: "03",
    title: "Executive Board Menganalisis",
    icon: Brain,
    desc: "CMO, CBO, dan CTO bekerja paralel menyusun diagnosis, kebocoran omzet, dan strategi — lalu diverifikasi Red Team.",
  },
  {
    n: "04",
    title: "Report & Roadmap Siap Eksekusi",
    icon: FileCheck2,
    desc: "Skor 4 pilar, revenue booster, aset done-for-you, dan roadmap 3 fase yang bisa langsung Anda centang & jalankan.",
  },
];

export const apiPartners = [
  "Firecrawl",
  "Apify",
  "Perplexity",
  "Claude",
  "Gemini",
  "OpenAI",
  "Google Analytics",
  "Zernio",
] as const;

export type Tier = {
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  featured?: boolean;
  highlight?: string;
  features: string[];
  cta: string;
};

export const tiers: Tier[] = [
  {
    name: "Starter Audit",
    price: "Rp 299.000",
    cadence: "sekali audit",
    tagline: "Diagnosis cepat untuk tahu di mana posisi bisnis Anda.",
    features: [
      "Skor 4 pilar bisnis (CRO, GEO, Social, Tech)",
      "Executive summary: 3 kebocoran + 3 peluang",
      "GEO / AI Search visibility check",
      "Roadmap high-level 3 fase",
      "1 revisi manual oleh tim",
    ],
    cta: "Mulai Audit",
  },
  {
    name: "Growth Pro",
    price: "Rp 1.499.000",
    cadence: "per bisnis",
    tagline: "Report lengkap + semua aset done-for-you. Paling laris.",
    featured: true,
    highlight: "Paling Direkomendasikan",
    features: [
      "Semua di Starter, plus:",
      "Analisis penuh CMO · CBO · CTO",
      "Kalender konten 30 hari + copywriting",
      "Wireframe landing page high-converting",
      "Workflow otomatisasi siap import (n8n/Zernio)",
      "Simulasi revenue booster + restrukturisasi offer",
      "Client dashboard + progress tracking",
    ],
    cta: "Pilih Growth Pro",
  },
  {
    name: "Scaleup DFY",
    price: "Custom",
    cadence: "retainer / project",
    tagline: "Kami eksekusikan. Dari strategi sampai custom software.",
    features: [
      "Semua di Growth Pro, plus:",
      "Eksekusi digital marketing & GEO campaign",
      "Pembangunan custom software / dashboard",
      "Integrasi WhatsApp, CRM & automation",
      "Audit berkala + dedicated strategist",
      "Prioritas support & SLA",
    ],
    cta: "Jadwalkan Konsultasi",
  },
];

export const stats = [
  { value: "< 2 mnt", label: "Waktu pengisian" },
  { value: "8 API", label: "Sumber data terpadu" },
  { value: "5 Agent", label: "AI C-level + Red Team" },
  { value: "3 Fase", label: "Roadmap terukur" },
] as const;

export const faqs = [
  {
    q: "Berapa lama sampai report saya jadi?",
    a: "Mesin memproses data secara paralel dan biasanya menyelesaikan analisis dalam hitungan menit. Anda akan melihat progress bar real-time, dan report muncul otomatis di dashboard begitu selesai.",
  },
  {
    q: "Data apa saja yang perlu saya sambungkan?",
    a: "Minimal cukup URL website, handle sosial media, dan 2 kompetitor utama. Untuk analisis lebih dalam, Anda bisa (opsional) menyambungkan Google Analytics dan Zernio agar skor konversi & penjualan lebih akurat.",
  },
  {
    q: "Apakah rekomendasinya generik seperti AI biasa?",
    a: "Tidak. Setiap report dibangun dari data nyata website, sosial media, dan posisi AI Search Anda — bukan template. Sebelum keluar, Red Team memverifikasi setiap angka agar realistis untuk skala bisnis Anda.",
  },
  {
    q: "Apakah brand saya benar-benar dicek di ChatGPT & Perplexity?",
    a: "Ya. Kami menjalankan query nyata ke AI Search untuk melihat apakah brand Anda direkomendasikan saat calon pembeli bertanya solusi di kategori Anda — dan membandingkannya dengan kompetitor.",
  },
  {
    q: "Saya bukan orang teknis. Apakah bisa saya eksekusi sendiri?",
    a: "Bisa. Roadmap dibagi per fase (Quick Wins, Growth, Custom Tech) dengan checklist yang bisa dicentang. Untuk yang butuh bantuan eksekusi, paket Scaleup DFY membuat tim kami yang mengerjakannya.",
  },
];

export const trustPoints = [
  "Tanpa perlu login akun sosial media Anda",
  "Data bisnis Anda aman & tidak dijual",
  "Verified oleh Red Team AI sebelum dikirim",
] as const;
