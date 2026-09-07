import type { WebBlock, WebsiteDoc, WebBlockType } from "./schema";
import { newBlock } from "./schema";

// Ready-made website models. The team picks one, then only edits the wording &
// swaps images — the structure, layout, and copy are already done.

type RawBlock = { type: WebBlockType; props: Record<string, unknown> };

export type WebsiteTemplate = {
  id: string;
  name: string;
  description: string;
  primary: string;
  hero: string; // hero image path under /public
  blocks: RawBlock[];
};

const B = (type: WebBlockType, props: Record<string, unknown>): RawBlock => ({ type, props });

export const WEBSITE_TEMPLATES: WebsiteTemplate[] = [
  {
    id: "kuliner",
    name: "Kuliner / F&B",
    description: "Coffee shop, resto, katering — hangat & menggugah selera.",
    primary: "#C2410C",
    hero: "/templates/kuliner-hero.jpg",
    blocks: [
      B("hero", {
        headline: "Kopi & Hidangan yang Bikin Kangen",
        subheadline: "Racikan biji pilihan dan menu rumahan, disajikan hangat setiap hari.",
        ctaText: "Pesan Sekarang",
        ctaHref: "https://wa.me/62",
        image: "/templates/kuliner-hero.jpg",
      }),
      B("features", {
        title: "Kenapa Pelanggan Suka",
        items: [
          { title: "Bahan Segar", text: "Dibuat dadakan dari bahan berkualitas setiap hari." },
          { title: "Cozy & Nyaman", text: "Tempat pas untuk nongkrong, kerja, atau kumpul." },
          { title: "Pesan Antar", text: "Tinggal chat WhatsApp, pesanan diantar cepat." },
        ],
      }),
      B("products", {
        title: "Menu Favorit",
        items: [
          { name: "Kopi Susu Gula Aren", price: "Rp 22.000", image: "" },
          { name: "Nasi Ayam Bakar", price: "Rp 35.000", image: "" },
          { name: "Croissant Cokelat", price: "Rp 25.000", image: "" },
        ],
      }),
      B("testimonial", { quote: "“Kopinya juara, tempatnya nyaman. Langganan tiap minggu!”", author: "Sarah, Bandung" }),
      B("cta", {
        headline: "Lapar? Pesan Sekarang",
        text: "Chat kami di WhatsApp untuk pesan atau reservasi tempat.",
        buttonText: "Chat WhatsApp",
        buttonHref: "https://wa.me/62",
      }),
      B("contact", { title: "Kunjungi Kami", whatsapp: "+62 812-0000-0000", email: "halo@brand.com", address: "Jl. Kuliner No. 1, Bandung\nBuka 08.00 - 22.00" }),
      B("footer", { text: "© 2026 Brand Anda — Dibuat dengan ScaleUp." }),
    ],
  },
  {
    id: "fashion",
    name: "Toko Online / Fashion",
    description: "Brand fashion & produk retail dengan katalog + checkout WhatsApp.",
    primary: "#0F172A",
    hero: "/templates/fashion-hero.jpg",
    blocks: [
      B("hero", {
        headline: "Tampil Beda dengan Koleksi Terbaru",
        subheadline: "Fashion berkualitas, harga bersahabat. Koleksi baru setiap bulan.",
        ctaText: "Belanja Sekarang",
        ctaHref: "#produk",
        image: "/templates/fashion-hero.jpg",
      }),
      B("products", {
        title: "Koleksi Terlaris",
        items: [
          { name: "Oversized Tee", price: "Rp 149.000", image: "" },
          { name: "Denim Jacket", price: "Rp 399.000", image: "" },
          { name: "Tote Bag Kanvas", price: "Rp 99.000", image: "" },
        ],
      }),
      B("features", {
        title: "Belanja Tanpa Khawatir",
        items: [
          { title: "Gratis Ongkir", text: "Untuk pembelian minimal tertentu." },
          { title: "Garansi Tukar", text: "Salah ukuran? Tukar dalam 3 hari." },
          { title: "COD & Transfer", text: "Bayar sesuai yang paling nyaman." },
        ],
      }),
      B("testimonial", { quote: "“Bahannya adem, jahitan rapi, packing aman. Recommended!”", author: "Dinda, Surabaya" }),
      B("cta", {
        headline: "Jangan Sampai Kehabisan",
        text: "Stok terbatas. Order sekarang lewat WhatsApp.",
        buttonText: "Order via WhatsApp",
        buttonHref: "https://wa.me/62",
      }),
      B("contact", { title: "Hubungi Kami", whatsapp: "+62 812-0000-0000", email: "cs@brand.com", address: "Fast response 09.00 - 21.00" }),
      B("footer", { text: "© 2026 Brand Anda — Dibuat dengan ScaleUp." }),
    ],
  },
  {
    id: "jasa",
    name: "Jasa Profesional / Agency",
    description: "Konsultan, agensi, jasa B2B — bersih & meyakinkan.",
    primary: "#2563EB",
    hero: "/templates/jasa-hero.jpg",
    blocks: [
      B("hero", {
        headline: "Solusi Profesional untuk Bisnis Anda",
        subheadline: "Kami bantu bisnis Anda tumbuh dengan strategi yang terukur dan hasil nyata.",
        ctaText: "Konsultasi Gratis",
        ctaHref: "#kontak",
        image: "/templates/jasa-hero.jpg",
      }),
      B("features", {
        title: "Layanan Kami",
        items: [
          { title: "Strategi", text: "Perencanaan matang berbasis data." },
          { title: "Eksekusi", text: "Tim berpengalaman yang mengerjakan tuntas." },
          { title: "Laporan", text: "Progres transparan setiap periode." },
        ],
      }),
      B("about", {
        title: "Tentang Kami",
        text: "Tim kami telah membantu puluhan klien mencapai target mereka. Kami percaya hasil berbicara lebih dari janji — itulah kenapa klien kami bertahan lama.",
        image: "/templates/jasa-about.jpg",
      }),
      B("testimonial", { quote: "“Profesional, responsif, dan hasilnya melampaui ekspektasi kami.”", author: "Pak Andi, Direktur PT Maju" }),
      B("cta", {
        headline: "Siap Membawa Bisnis Anda Naik Kelas?",
        text: "Jadwalkan konsultasi gratis 30 menit hari ini.",
        buttonText: "Jadwalkan Konsultasi",
        buttonHref: "https://wa.me/62",
      }),
      B("contact", { title: "Hubungi Kami", whatsapp: "+62 812-0000-0000", email: "hello@brand.com", address: "Senin - Jumat, 09.00 - 17.00" }),
      B("footer", { text: "© 2026 Brand Anda — Dibuat dengan ScaleUp." }),
    ],
  },
  {
    id: "klinik",
    name: "Klinik & Kecantikan",
    description: "Klinik, skincare, salon, wellness — lembut & terpercaya.",
    primary: "#DB2777",
    hero: "/templates/klinik-hero.jpg",
    blocks: [
      B("hero", {
        headline: "Rawat Diri, Tampil Percaya Diri",
        subheadline: "Perawatan aman oleh tenaga profesional dengan hasil yang terlihat.",
        ctaText: "Booking Sekarang",
        ctaHref: "#kontak",
        image: "/templates/klinik-hero.jpg",
      }),
      B("features", {
        title: "Kenapa Memilih Kami",
        items: [
          { title: "Tenaga Ahli", text: "Ditangani dokter & terapis bersertifikat." },
          { title: "Produk Aman", text: "Bahan teruji dan berizin resmi." },
          { title: "Hasil Nyata", text: "Ribuan pelanggan puas dengan hasilnya." },
        ],
      }),
      B("products", {
        title: "Treatment Populer",
        items: [
          { name: "Facial Glow", price: "Rp 250.000", image: "" },
          { name: "Perawatan Rambut", price: "Rp 180.000", image: "" },
          { name: "Paket Bridal", price: "Rp 1.500.000", image: "" },
        ],
      }),
      B("testimonial", { quote: "“Pelayanan ramah, tempat bersih, hasilnya bikin makin pede.”", author: "Rina, Jakarta" }),
      B("cta", {
        headline: "Jadwalkan Perawatan Anda",
        text: "Slot terbatas setiap harinya — booking lewat WhatsApp.",
        buttonText: "Booking via WhatsApp",
        buttonHref: "https://wa.me/62",
      }),
      B("contact", { title: "Lokasi & Kontak", whatsapp: "+62 812-0000-0000", email: "booking@brand.com", address: "Jl. Sehat No. 2, Jakarta\nBuka setiap hari 09.00 - 20.00" }),
      B("footer", { text: "© 2026 Brand Anda — Dibuat dengan ScaleUp." }),
    ],
  },
  {
    id: "edukasi",
    name: "Kursus & Edukasi",
    description: "Bimbel, kelas online, workshop — jelas & memotivasi.",
    primary: "#7C3AED",
    hero: "/templates/edukasi-hero.jpg",
    blocks: [
      B("hero", {
        headline: "Belajar Skill Baru, Buka Peluang Baru",
        subheadline: "Kelas praktis dengan mentor berpengalaman. Belajar dari mana saja.",
        ctaText: "Daftar Kelas",
        ctaHref: "#produk",
        image: "/templates/edukasi-hero.jpg",
      }),
      B("features", {
        title: "Kenapa Belajar di Sini",
        items: [
          { title: "Mentor Praktisi", text: "Diajar langsung oleh yang sudah berpengalaman." },
          { title: "Materi Terstruktur", text: "Dari dasar sampai mahir, mudah diikuti." },
          { title: "Sertifikat", text: "Dapat sertifikat kelulusan resmi." },
        ],
      }),
      B("products", {
        title: "Kelas Populer",
        items: [
          { name: "Digital Marketing", price: "Rp 499.000", image: "" },
          { name: "Desain Grafis", price: "Rp 399.000", image: "" },
          { name: "Public Speaking", price: "Rp 299.000", image: "" },
        ],
      }),
      B("cta", {
        headline: "Mulai Belajar Hari Ini",
        text: "Kuota per batch terbatas. Amankan tempat Anda sekarang.",
        buttonText: "Daftar via WhatsApp",
        buttonHref: "https://wa.me/62",
      }),
      B("contact", { title: "Info & Pendaftaran", whatsapp: "+62 812-0000-0000", email: "daftar@brand.com", address: "Admin online 08.00 - 20.00" }),
      B("footer", { text: "© 2026 Brand Anda — Dibuat dengan ScaleUp." }),
    ],
  },
  {
    id: "properti",
    name: "Properti / Real Estate",
    description: "Agen properti, perumahan, kos — elegan & terpercaya.",
    primary: "#0F766E",
    hero: "/templates/properti-hero.jpg",
    blocks: [
      B("hero", {
        headline: "Temukan Hunian Impian Anda",
        subheadline: "Pilihan properti terbaik dengan lokasi strategis dan harga terbaik.",
        ctaText: "Lihat Listing",
        ctaHref: "#produk",
        image: "/templates/properti-hero.jpg",
      }),
      B("products", {
        title: "Listing Unggulan",
        items: [
          { name: "Rumah 2 Lantai, Bekasi", price: "Rp 850 jt", image: "" },
          { name: "Apartemen Studio, Jakarta", price: "Rp 450 jt", image: "" },
          { name: "Tanah Kavling, Bogor", price: "Rp 300 jt", image: "" },
        ],
      }),
      B("features", {
        title: "Kenapa Lewat Kami",
        items: [
          { title: "Legalitas Aman", text: "Semua unit bersertifikat & terverifikasi." },
          { title: "Bantuan KPR", text: "Proses cicilan dibantu sampai approve." },
          { title: "Survey Gratis", text: "Antar-jemput lokasi tanpa biaya." },
        ],
      }),
      B("cta", {
        headline: "Konsultasi Properti Gratis",
        text: "Ceritakan kebutuhan Anda, kami carikan yang paling pas.",
        buttonText: "Konsultasi via WhatsApp",
        buttonHref: "https://wa.me/62",
      }),
      B("contact", { title: "Hubungi Agen Kami", whatsapp: "+62 812-0000-0000", email: "info@brand.com", address: "Senin - Sabtu, 09.00 - 18.00" }),
      B("footer", { text: "© 2026 Brand Anda — Dibuat dengan ScaleUp." }),
    ],
  },
];

/** Build a fresh editable doc from a template (new block ids + brand applied). */
export function templateDoc(templateId: string, brand: string): WebsiteDoc | null {
  const t = WEBSITE_TEMPLATES.find((x) => x.id === templateId);
  if (!t) return null;
  const blocks: WebBlock[] = t.blocks.map((b) => {
    const fresh = newBlock(b.type);
    return { id: fresh.id, type: b.type, props: JSON.parse(JSON.stringify(b.props)) };
  });
  return { theme: { primary: t.primary, brand, logo: "" }, blocks };
}
