export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] };

export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string; // ISO
  readMinutes: number;
  content: Block[];
};

export const posts: Post[] = [
  {
    slug: "geo-kenapa-brand-anda-harus-muncul-di-chatgpt",
    title:
      "GEO: Kenapa Brand Anda Harus Muncul di ChatGPT & Perplexity, Bukan Cuma Google",
    excerpt:
      "Calon pembeli mulai bertanya ke AI, bukan mengetik di kolom pencarian. Kalau brand Anda tidak dikutip AI, Anda tidak ada di meja pertimbangan mereka.",
    category: "GEO",
    date: "2026-08-28",
    readMinutes: 6,
    content: [
      {
        type: "p",
        text: "Selama 20 tahun, SEO adalah permainannya: buat konten, kejar ranking di Google, tunggu klik. Tapi perilaku pencarian sedang bergeser. Semakin banyak calon pembeli yang langsung bertanya ke ChatGPT, Perplexity, atau Gemini — 'jasa X terbaik di Jakarta apa?' — dan menerima satu jawaban ringkas berisi beberapa nama brand.",
      },
      {
        type: "p",
        text: "Di sinilah GEO (Generative Engine Optimization) masuk. GEO adalah upaya memastikan brand Anda ikut dikutip saat AI menyusun jawabannya. Kalau kompetitor disebut dan Anda tidak, Anda kalah sebelum pertandingan dimulai.",
      },
      { type: "h2", text: "Kenapa ini mendesak sekarang" },
      {
        type: "ul",
        items: [
          "AI Search memberi jawaban tunggal, bukan 10 link — ruang untuk 'terlihat' jauh lebih sempit.",
          "AI cenderung mengutip brand dengan sitasi terstruktur, ulasan, dan liputan yang konsisten.",
          "Sekali sebuah brand jadi 'jawaban default' di kategori, sulit digeser kompetitor.",
        ],
      },
      { type: "h2", text: "Cara mengeceknya" },
      {
        type: "p",
        text: "Jalankan pertanyaan yang biasa diketik calon pembeli Anda ke beberapa AI, lalu catat: apakah brand Anda muncul? Berapa sering kompetitor muncul? Inilah yang kami sebut Share of Voice di era generative search — dan ini bagian inti dari setiap audit ScaleUp.",
      },
      {
        type: "p",
        text: "Kabar baiknya: GEO masih 'lapangan kosong' untuk mayoritas bisnis lokal. Yang bergerak lebih dulu akan menikmati keunggulan yang majemuk.",
      },
    ],
  },
  {
    slug: "5-kebocoran-omzet-bisnis-online",
    title: "5 Kebocoran Omzet yang Diam-Diam Menggerus Bisnis Online Anda",
    excerpt:
      "Traffic Anda mungkin sudah bagus. Masalahnya sering bukan di 'atas corong', tapi di kebocoran-kebocoran kecil yang membuat pembeli lolos.",
    category: "CRO",
    date: "2026-08-20",
    readMinutes: 5,
    content: [
      {
        type: "p",
        text: "Banyak pemilik bisnis buru-buru menambah budget iklan padahal masalah sebenarnya ada di kebocoran konversi. Menambal kebocoran hampir selalu lebih murah daripada memompa lebih banyak traffic ke ember yang bocor.",
      },
      { type: "h2", text: "Kebocoran yang paling sering kami temukan" },
      {
        type: "ul",
        items: [
          "Tombol WhatsApp tanpa tracking/otomatisasi — chat masuk tidak pernah di-follow up.",
          "Value proposition tertutup banner promo di layar pertama (fold).",
          "Tidak ada lead magnet untuk menangkap yang belum siap beli.",
          "Halaman checkout penuh friksi: form panjang, ongkir mengejutkan, tanpa trust signal.",
          "Repeat order manual — tidak ada pengingat, LTV pelanggan tertahan.",
        ],
      },
      { type: "h2", text: "Cara memprioritaskan perbaikan" },
      {
        type: "p",
        text: "Urutkan berdasarkan Impact vs Effort. Perbaikan CTA dan follow-up WhatsApp biasanya High Impact tapi Low Effort — itulah 'quick wins' yang kami taruh di Fase 1 setiap roadmap.",
      },
      {
        type: "p",
        text: "Simulasi sederhana: menaikkan conversion rate dari 1,1% ke 2,8% di traffic yang sama bisa berarti lebih dari dua kali lipat penjualan — tanpa satu rupiah pun tambahan iklan.",
      },
    ],
  },
  {
    slug: "whatsapp-funnel-menaikkan-closing",
    title: "Dari Manual ke Otomatis: Cara WhatsApp Funnel Menaikkan Closing 35%",
    excerpt:
      "Membalas chat satu per satu tidak akan menskalakan bisnis Anda. Otomatisasi yang tepat menjaga setiap lead tetap hangat tanpa menambah tim.",
    category: "Automation",
    date: "2026-08-12",
    readMinutes: 7,
    content: [
      {
        type: "p",
        text: "WhatsApp adalah kanal penjualan terkuat di Indonesia — tapi juga paling mudah bocor. Lead menumpuk, balasan telat, follow-up terlupa. Jawabannya bukan menambah admin, melainkan membangun funnel otomatis.",
      },
      { type: "h2", text: "Anatomi WhatsApp funnel yang sehat" },
      {
        type: "ul",
        items: [
          "Titik masuk yang ter-tracking (klik iklan / tombol web → percakapan yang tercatat).",
          "Sapaan & kualifikasi otomatis untuk memilah lead serius.",
          "Urutan follow-up terjadwal untuk yang belum closing.",
          "Pengingat repeat order & winback untuk pelanggan lama.",
        ],
      },
      { type: "h2", text: "Kenapa dampaknya besar" },
      {
        type: "p",
        text: "Sebagian besar penjualan terjadi setelah follow-up ke-2 hingga ke-5 — justru di titik itulah proses manual paling sering gagal. Dengan otomatisasi, tidak ada lead yang jatuh dari celah, dan tim Anda fokus menutup deal, bukan mengetik ulang balasan yang sama.",
      },
      {
        type: "p",
        text: "Di ScaleUp, rekomendasi seperti ini datang lengkap dengan blueprint workflow yang siap diimpor — bukan sekadar saran, tapi aset yang tinggal dijalankan.",
      },
    ],
  },
];

export function getPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
