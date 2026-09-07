import { newBlock, newPage, type WebBlock, type WebsiteDoc } from "./schema";

// Ready-made, COMPLETE multi-page websites. Each template is content data;
// buildDoc() assembles the full Home / Produk / FAQ / Blog / Kontak pages.
// The team only edits wording.

type Item = Record<string, string>;
type Post = { title: string; date: string; excerpt: string; body: string; cover: string };

export type WebsiteTemplate = {
  id: string;
  name: string;
  description: string;
  primary: string;
  whatsapp: string;
  heroImage: string;
  aboutImage: string;
  productLabel: string;
  productSubtitle: string;
  hero: { headline: string; subheadline: string; ctaText: string };
  features: { title: string; items: Item[] };
  about: { title: string; text: string };
  products: { title: string; items: Item[] };
  faqs: Item[];
  testimonial: { quote: string; author: string };
  posts: Post[];
  contact: { title: string; email: string; address: string; hours: string };
  cta: { headline: string; text: string; buttonText: string };
};

const blk = (type: Parameters<typeof newBlock>[0], props: Record<string, unknown>): WebBlock => ({
  ...newBlock(type),
  props,
});

function waHref(whatsapp: string): string {
  const d = whatsapp.replace(/[^0-9]/g, "");
  return d ? `https://wa.me/${d}` : "#kontak";
}

export function buildDoc(t: WebsiteTemplate, brand: string): WebsiteDoc {
  const wa = waHref(t.whatsapp);
  const cta = blk("cta", { ...t.cta, buttonHref: wa });
  const postsWithCover = t.posts.map((p) => ({ ...p, cover: p.cover || t.heroImage }));

  return {
    theme: { primary: t.primary, brand, logo: "", whatsapp: t.whatsapp },
    pages: [
      newPage("", "Home", [
        blk("hero", {
          headline: t.hero.headline,
          subheadline: t.hero.subheadline,
          ctaText: t.hero.ctaText,
          ctaHref: wa,
          image: t.heroImage,
        }),
        blk("features", t.features),
        blk("about", { ...t.about, image: t.aboutImage || t.heroImage }),
        blk("products", { title: `${t.productLabel} Unggulan`, items: t.products.items.slice(0, 3) }),
        blk("testimonial", t.testimonial),
        cta,
      ]),
      newPage("produk", t.productLabel, [
        blk("pageheader", { title: t.productLabel, subtitle: t.productSubtitle }),
        blk("products", t.products),
        cta,
      ]),
      newPage("faq", "FAQ", [
        blk("pageheader", { title: "Pertanyaan Umum", subtitle: "Hal yang paling sering ditanyakan pelanggan kami." }),
        blk("faq", { title: "", items: t.faqs }),
        cta,
      ]),
      newPage("blog", "Blog", [
        blk("pageheader", { title: "Blog & Artikel", subtitle: "Tips, kabar, dan cerita terbaru dari kami." }),
        blk("posts", { title: "", items: postsWithCover }),
      ]),
      newPage("kontak", "Kontak", [
        blk("pageheader", { title: "Hubungi Kami", subtitle: "Kami siap membantu — hubungi kapan saja." }),
        blk("contact", { title: t.contact.title, whatsapp: t.whatsapp, email: t.contact.email, address: t.contact.address, hours: t.contact.hours }),
        cta,
      ]),
    ],
  };
}

export const WEBSITE_TEMPLATES: WebsiteTemplate[] = [
  {
    id: "kuliner",
    name: "Kuliner / F&B",
    description: "Coffee shop, resto, katering — hangat & menggugah selera.",
    primary: "#C2410C",
    whatsapp: "+62 812-1111-1111",
    heroImage: "/templates/kuliner-hero.jpg",
    aboutImage: "/templates/kuliner-hero.jpg",
    productLabel: "Menu",
    productSubtitle: "Menu favorit yang dibuat segar setiap hari.",
    hero: { headline: "Kopi & Hidangan yang Bikin Kangen", subheadline: "Racikan biji pilihan dan menu rumahan, disajikan hangat setiap hari.", ctaText: "Pesan Sekarang" },
    features: {
      title: "Kenapa Pelanggan Suka",
      items: [
        { title: "Bahan Segar", text: "Dibuat dadakan dari bahan berkualitas setiap hari." },
        { title: "Tempat Nyaman", text: "Cocok untuk nongkrong, kerja, atau kumpul keluarga." },
        { title: "Pesan Antar", text: "Tinggal chat WhatsApp, pesanan diantar cepat." },
      ],
    },
    about: { title: "Tentang Kami", text: "Berawal dari kecintaan pada kopi dan masakan rumahan, kami hadir untuk menyajikan rasa yang jujur dengan harga bersahabat. Setiap sajian kami buat dengan sepenuh hati." },
    products: {
      title: "Menu Kami",
      items: [
        { name: "Kopi Susu Gula Aren", price: "Rp 22.000", desc: "Signature, manisnya pas.", image: "" },
        { name: "Nasi Ayam Bakar", price: "Rp 35.000", desc: "Ayam bakar bumbu meresap + sambal.", image: "" },
        { name: "Croissant Cokelat", price: "Rp 25.000", desc: "Renyah di luar, lumer di dalam.", image: "" },
        { name: "Es Teh Leci", price: "Rp 18.000", desc: "Segar untuk siang hari.", image: "" },
        { name: "Mie Ayam Spesial", price: "Rp 30.000", desc: "Porsi mengenyangkan.", image: "" },
        { name: "Kentang Goreng", price: "Rp 20.000", desc: "Teman ngobrol paling pas.", image: "" },
      ],
    },
    faqs: [
      { q: "Bagaimana cara memesan?", a: "Bisa datang langsung ke outlet atau pesan lewat WhatsApp untuk diantar." },
      { q: "Apakah menerima pesanan katering / acara?", a: "Ya, kami melayani pesanan dalam jumlah besar. Hubungi kami minimal H-2." },
      { q: "Area pengiriman ke mana saja?", a: "Kami mengirim ke seluruh area kota dan sekitarnya via ojek online." },
      { q: "Apakah ada tempat parkir?", a: "Tersedia parkir motor dan mobil di depan outlet." },
      { q: "Jam berapa buka?", a: "Setiap hari 08.00 - 22.00, termasuk akhir pekan." },
      { q: "Metode pembayaran apa saja?", a: "Tunai, transfer bank, QRIS, dan e-wallet." },
    ],
    testimonial: { quote: "“Kopinya juara, tempatnya nyaman. Langganan tiap minggu!”", author: "Sarah, Bandung" },
    posts: [
      { title: "Rahasia Kopi Susu Gula Aren Kami", date: "Sep 2026", excerpt: "Kenapa signature kami selalu jadi favorit pelanggan.", cover: "", body: "Kopi susu gula aren kami bukan sekadar tren.\n\n## Biji Pilihan\nKami memakai biji arabika lokal yang disangrai medium untuk rasa seimbang.\n\n## Gula Aren Asli\nManisnya datang dari gula aren asli, bukan sirup — lebih lembut dan wangi." },
      { title: "5 Menu Wajib Coba untuk Pertama Kali", date: "Agu 2026", excerpt: "Baru pertama mampir? Ini rekomendasi kami.", cover: "", body: "Bingung mau pesan apa? Mulai dari lima menu ini.\n\n- Kopi Susu Gula Aren\n- Nasi Ayam Bakar\n- Croissant Cokelat\n- Mie Ayam Spesial\n- Es Teh Leci\n\nSemua favorit pelanggan dan cocok untuk pemula." },
      { title: "Tips Nongkrong Produktif di Cafe", date: "Jul 2026", excerpt: "Biar ngopi sambil kerja tetap fokus.", cover: "", body: "Cafe bisa jadi tempat kerja yang nyaman.\n\nPilih meja dekat colokan, pesan minuman favorit, dan manfaatkan WiFi kami yang kencang. Selamat produktif!" },
    ],
    contact: { title: "Kunjungi Outlet Kami", email: "halo@brand.com", address: "Jl. Kuliner No. 1, Bandung", hours: "Setiap hari 08.00 - 22.00" },
    cta: { headline: "Lapar? Pesan Sekarang", text: "Chat kami di WhatsApp untuk pesan atau reservasi tempat.", buttonText: "Chat WhatsApp" },
  },
  {
    id: "fashion",
    name: "Toko Online / Fashion",
    description: "Brand fashion & retail dengan katalog + checkout WhatsApp.",
    primary: "#0F172A",
    whatsapp: "+62 812-2222-2222",
    heroImage: "/templates/fashion-hero.jpg",
    aboutImage: "/templates/fashion-hero.jpg",
    productLabel: "Produk",
    productSubtitle: "Koleksi terbaru yang bikin tampil beda.",
    hero: { headline: "Tampil Beda dengan Koleksi Terbaru", subheadline: "Fashion berkualitas, harga bersahabat. Koleksi baru setiap bulan.", ctaText: "Belanja Sekarang" },
    features: {
      title: "Belanja Tanpa Khawatir",
      items: [
        { title: "Gratis Ongkir", text: "Untuk pembelian minimal tertentu ke seluruh Indonesia." },
        { title: "Garansi Tukar", text: "Salah ukuran? Tukar dalam 3 hari, gratis." },
        { title: "COD & Transfer", text: "Bayar dengan cara yang paling nyaman untuk Anda." },
      ],
    },
    about: { title: "Cerita Brand Kami", text: "Kami percaya gaya tidak harus mahal. Setiap koleksi dirancang agar Anda tampil percaya diri setiap hari, dengan bahan nyaman dan jahitan rapi yang tahan lama." },
    products: {
      title: "Katalog Produk",
      items: [
        { name: "Oversized Tee", price: "Rp 149.000", desc: "Katun premium, adem.", image: "" },
        { name: "Denim Jacket", price: "Rp 399.000", desc: "Klasik, cocok segala gaya.", image: "" },
        { name: "Tote Bag Kanvas", price: "Rp 99.000", desc: "Kuat & muat banyak.", image: "" },
        { name: "Kaos Polos Premium", price: "Rp 89.000", desc: "Tersedia 8 warna.", image: "" },
        { name: "Celana Cargo", price: "Rp 259.000", desc: "Banyak kantong, stylish.", image: "" },
        { name: "Topi Bucket", price: "Rp 79.000", desc: "Aksesori pelengkap look.", image: "" },
      ],
    },
    faqs: [
      { q: "Bagaimana cara pesan?", a: "Pilih produk, lalu klik tombol WhatsApp untuk checkout dengan admin kami." },
      { q: "Berapa lama pengiriman?", a: "1-3 hari untuk Pulau Jawa, 3-7 hari luar Jawa." },
      { q: "Apakah bisa COD?", a: "Bisa, tersedia untuk area tertentu. Konfirmasi dengan admin." },
      { q: "Bagaimana kebijakan tukar/retur?", a: "Tukar ukuran gratis dalam 3 hari selama label masih terpasang." },
      { q: "Apakah stok selalu ready?", a: "Stok kami update harian. Chat admin untuk memastikan ketersediaan." },
    ],
    testimonial: { quote: "“Bahannya adem, jahitan rapi, packing aman. Recommended!”", author: "Dinda, Surabaya" },
    posts: [
      { title: "Cara Padu Padan Oversized Tee", date: "Sep 2026", excerpt: "Satu kaos, banyak gaya.", cover: "", body: "Oversized tee itu serbaguna.\n\nPadukan dengan celana cargo untuk kesan kasual, atau tuck-in dengan rok untuk look yang lebih rapi." },
      { title: "Panduan Ukuran Agar Tidak Salah Beli", date: "Agu 2026", excerpt: "Ukur dulu sebelum checkout.", cover: "", body: "Salah ukuran bikin kecewa.\n\n## Ukur Badan Anda\nGunakan meteran untuk lingkar dada dan panjang badan, lalu cocokkan dengan tabel ukuran kami." },
      { title: "Tren Fashion Musim Ini", date: "Jul 2026", excerpt: "Warna dan gaya yang lagi naik daun.", cover: "", body: "Musim ini didominasi warna earth tone dan potongan longgar. Kami sudah menyiapkan koleksinya untuk Anda." },
    ],
    contact: { title: "Hubungi Customer Service", email: "cs@brand.com", address: "Fast response via WhatsApp", hours: "Setiap hari 09.00 - 21.00" },
    cta: { headline: "Jangan Sampai Kehabisan", text: "Stok terbatas. Order sekarang lewat WhatsApp.", buttonText: "Order via WhatsApp" },
  },
  {
    id: "jasa",
    name: "Jasa Profesional / Agency",
    description: "Konsultan, agensi, jasa B2B — bersih & meyakinkan.",
    primary: "#2563EB",
    whatsapp: "+62 812-3333-3333",
    heroImage: "/templates/jasa-hero.jpg",
    aboutImage: "/templates/jasa-about.jpg",
    productLabel: "Layanan",
    productSubtitle: "Layanan yang dirancang untuk hasil nyata.",
    hero: { headline: "Solusi Profesional untuk Bisnis Anda", subheadline: "Kami bantu bisnis Anda tumbuh dengan strategi terukur dan hasil nyata.", ctaText: "Konsultasi Gratis" },
    features: {
      title: "Cara Kami Bekerja",
      items: [
        { title: "Strategi", text: "Perencanaan matang berbasis data, bukan tebakan." },
        { title: "Eksekusi", text: "Tim berpengalaman yang mengerjakan sampai tuntas." },
        { title: "Laporan", text: "Progres transparan yang bisa Anda pantau tiap periode." },
      ],
    },
    about: { title: "Tentang Kami", text: "Tim kami telah membantu puluhan klien mencapai target mereka. Kami percaya hasil berbicara lebih dari janji — itulah kenapa klien kami bertahan lama bersama kami." },
    products: {
      title: "Layanan Kami",
      items: [
        { name: "Konsultasi Strategi", price: "Mulai Rp 2.500.000", desc: "Audit + roadmap pertumbuhan.", image: "" },
        { name: "Manajemen Digital", price: "Retainer bulanan", desc: "Kelola end-to-end oleh tim kami.", image: "" },
        { name: "Pelatihan Tim", price: "Custom", desc: "Workshop untuk tim internal Anda.", image: "" },
      ],
    },
    faqs: [
      { q: "Bagaimana proses kerja sama dimulai?", a: "Dimulai dari konsultasi gratis untuk memahami kebutuhan Anda, lalu kami susun proposal." },
      { q: "Berapa lama hasil terlihat?", a: "Tergantung layanan; kami selalu menetapkan target dan timeline yang jelas di awal." },
      { q: "Apakah ada kontrak minimum?", a: "Untuk layanan retainer umumnya minimal 3 bulan agar hasil optimal." },
      { q: "Bagaimana pelaporannya?", a: "Anda mendapat laporan berkala dan sesi review langsung dengan tim." },
      { q: "Industri apa saja yang pernah ditangani?", a: "Beragam — F&B, retail, jasa, hingga B2B. Hubungi kami untuk portofolio." },
    ],
    testimonial: { quote: "“Profesional, responsif, dan hasilnya melampaui ekspektasi kami.”", author: "Pak Andi, Direktur PT Maju" },
    posts: [
      { title: "3 Kesalahan yang Menghambat Pertumbuhan Bisnis", date: "Sep 2026", excerpt: "Hindari jebakan umum ini.", cover: "", body: "Banyak bisnis stagnan karena hal yang sebenarnya bisa dihindari.\n\n## 1. Tanpa Strategi\nBergerak tanpa arah menguras sumber daya.\n\n## 2. Tidak Mengukur\nYang tidak diukur tidak bisa diperbaiki." },
      { title: "Kenapa Data Penting untuk Keputusan Bisnis", date: "Agu 2026", excerpt: "Berhenti menebak, mulai mengukur.", cover: "", body: "Keputusan berbasis data mengurangi risiko dan mempercepat pertumbuhan. Kami bantu Anda membaca angka yang benar-benar penting." },
      { title: "Membangun Tim yang Produktif", date: "Jul 2026", excerpt: "Sistem yang membuat tim bergerak selaras.", cover: "", body: "Produktivitas bukan soal kerja lebih keras, tapi lebih terarah. Mulai dari SOP yang jelas dan prioritas yang benar." },
    ],
    contact: { title: "Jadwalkan Konsultasi", email: "hello@brand.com", address: "Jakarta — melayani klien nasional", hours: "Senin - Jumat, 09.00 - 17.00" },
    cta: { headline: "Siap Membawa Bisnis Anda Naik Kelas?", text: "Jadwalkan konsultasi gratis 30 menit hari ini.", buttonText: "Jadwalkan Konsultasi" },
  },
  {
    id: "klinik",
    name: "Klinik & Kecantikan",
    description: "Klinik, skincare, salon, wellness — lembut & terpercaya.",
    primary: "#DB2777",
    whatsapp: "+62 812-4444-4444",
    heroImage: "/templates/klinik-hero.jpg",
    aboutImage: "/templates/klinik-hero.jpg",
    productLabel: "Treatment",
    productSubtitle: "Perawatan aman dengan hasil yang terlihat.",
    hero: { headline: "Rawat Diri, Tampil Percaya Diri", subheadline: "Perawatan aman oleh tenaga profesional dengan hasil yang terlihat.", ctaText: "Booking Sekarang" },
    features: {
      title: "Kenapa Memilih Kami",
      items: [
        { title: "Tenaga Ahli", text: "Ditangani dokter & terapis bersertifikat." },
        { title: "Produk Aman", text: "Bahan teruji dan berizin resmi BPOM." },
        { title: "Hasil Nyata", text: "Ribuan pelanggan puas dengan hasilnya." },
      ],
    },
    about: { title: "Tentang Klinik Kami", text: "Kami berkomitmen menghadirkan perawatan yang aman, nyaman, dan efektif. Kesehatan dan kepercayaan diri Anda adalah prioritas kami." },
    products: {
      title: "Daftar Treatment",
      items: [
        { name: "Facial Glow", price: "Rp 250.000", desc: "Kulit cerah & lembap seketika.", image: "" },
        { name: "Perawatan Rambut", price: "Rp 180.000", desc: "Nutrisi untuk rambut sehat.", image: "" },
        { name: "Paket Bridal", price: "Rp 1.500.000", desc: "Tampil sempurna di hari spesial.", image: "" },
        { name: "Chemical Peeling", price: "Rp 350.000", desc: "Angkat sel kulit mati.", image: "" },
        { name: "Body Massage", price: "Rp 200.000", desc: "Relaksasi tubuh menyeluruh.", image: "" },
      ],
    },
    faqs: [
      { q: "Apakah perlu booking dulu?", a: "Sangat disarankan agar tidak menunggu. Booking mudah lewat WhatsApp." },
      { q: "Apakah treatment aman untuk kulit sensitif?", a: "Kami lakukan konsultasi awal untuk menyesuaikan treatment dengan kondisi kulit Anda." },
      { q: "Berapa kali treatment untuk hasil optimal?", a: "Bervariasi per treatment; terapis akan menyarankan jadwal yang tepat." },
      { q: "Apakah produk yang dipakai aman?", a: "Semua produk berizin resmi dan teruji." },
      { q: "Apakah ada paket membership?", a: "Ada, dengan harga khusus. Tanyakan ke resepsionis kami." },
    ],
    testimonial: { quote: "“Pelayanan ramah, tempat bersih, hasilnya bikin makin pede.”", author: "Rina, Jakarta" },
    posts: [
      { title: "Urutan Skincare yang Benar", date: "Sep 2026", excerpt: "Biar produk bekerja maksimal.", cover: "", body: "Urutan pemakaian skincare menentukan hasilnya.\n\n- Pembersih\n- Toner\n- Serum\n- Pelembap\n- Sunscreen (pagi)\n\nKonsisten adalah kuncinya." },
      { title: "Mitos vs Fakta Perawatan Wajah", date: "Agu 2026", excerpt: "Jangan mudah percaya mitos.", cover: "", body: "Banyak mitos kecantikan yang menyesatkan.\n\n## Mitos: Semakin perih, semakin bekerja\nFakta: Perih justru bisa tanda iritasi. Pilih produk yang sesuai kulit Anda." },
      { title: "Persiapan Kulit Sebelum Hari Pernikahan", date: "Jul 2026", excerpt: "Glowing di hari bahagia.", cover: "", body: "Mulai perawatan minimal 3 bulan sebelum hari-H untuk hasil terbaik. Konsultasikan paket bridal kami." },
    ],
    contact: { title: "Lokasi & Booking", email: "booking@brand.com", address: "Jl. Sehat No. 2, Jakarta", hours: "Setiap hari 09.00 - 20.00" },
    cta: { headline: "Jadwalkan Perawatan Anda", text: "Slot terbatas setiap harinya — booking lewat WhatsApp.", buttonText: "Booking via WhatsApp" },
  },
  {
    id: "edukasi",
    name: "Kursus & Edukasi",
    description: "Bimbel, kelas online, workshop — jelas & memotivasi.",
    primary: "#7C3AED",
    whatsapp: "+62 812-5555-5555",
    heroImage: "/templates/edukasi-hero.jpg",
    aboutImage: "/templates/edukasi-hero.jpg",
    productLabel: "Kelas",
    productSubtitle: "Kelas praktis dengan mentor berpengalaman.",
    hero: { headline: "Belajar Skill Baru, Buka Peluang Baru", subheadline: "Kelas praktis dengan mentor berpengalaman. Belajar dari mana saja.", ctaText: "Daftar Kelas" },
    features: {
      title: "Kenapa Belajar di Sini",
      items: [
        { title: "Mentor Praktisi", text: "Diajar langsung oleh yang sudah berpengalaman di bidangnya." },
        { title: "Materi Terstruktur", text: "Dari dasar sampai mahir, mudah diikuti pemula." },
        { title: "Sertifikat", text: "Dapatkan sertifikat kelulusan resmi." },
      ],
    },
    about: { title: "Tentang Kami", text: "Kami hadir agar siapa pun bisa belajar skill yang relevan dengan dunia kerja. Ribuan alumni kami telah naik kelas dalam karier dan usaha mereka." },
    products: {
      title: "Daftar Kelas",
      items: [
        { name: "Digital Marketing", price: "Rp 499.000", desc: "Kuasai iklan & konten yang menjual.", image: "" },
        { name: "Desain Grafis", price: "Rp 399.000", desc: "Dari nol sampai bikin portofolio.", image: "" },
        { name: "Public Speaking", price: "Rp 299.000", desc: "Percaya diri berbicara di depan umum.", image: "" },
        { name: "Bisnis Online", price: "Rp 449.000", desc: "Mulai & kembangkan usaha online.", image: "" },
      ],
    },
    faqs: [
      { q: "Apakah kelas online atau offline?", a: "Tersedia keduanya. Kelas online bisa diakses dari mana saja." },
      { q: "Apakah dapat sertifikat?", a: "Ya, setiap peserta yang menyelesaikan kelas mendapat sertifikat." },
      { q: "Apakah cocok untuk pemula?", a: "Sangat cocok. Materi disusun bertahap dari dasar." },
      { q: "Bagaimana cara mendaftar?", a: "Klik daftar via WhatsApp, admin akan memandu prosesnya." },
      { q: "Apakah ada cicilan?", a: "Tersedia opsi pembayaran bertahap untuk kelas tertentu." },
    ],
    testimonial: { quote: "“Materinya daging semua, mentornya sabar. Langsung kepakai di kerjaan!”", author: "Fajar, alumni" },
    posts: [
      { title: "Skill Paling Dicari di 2026", date: "Sep 2026", excerpt: "Siapkan diri untuk peluang baru.", cover: "", body: "Dunia kerja terus berubah.\n\nSkill digital seperti marketing, data, dan desain makin dibutuhkan. Mulai belajar sekarang sebelum tertinggal." },
      { title: "Cara Belajar Efektif untuk Orang Sibuk", date: "Agu 2026", excerpt: "Konsisten walau waktu terbatas.", cover: "", body: "Belajar tidak harus lama.\n\n- Sisihkan 30 menit sehari\n- Fokus satu topik\n- Praktik langsung\n\nKonsistensi mengalahkan intensitas." },
      { title: "Membangun Portofolio yang Dilirik", date: "Jul 2026", excerpt: "Bukti karya lebih kuat dari sekadar CV.", cover: "", body: "Portofolio menunjukkan kemampuan nyata Anda. Di kelas kami, Anda menyelesaikan proyek yang bisa langsung masuk portofolio." },
    ],
    contact: { title: "Info & Pendaftaran", email: "daftar@brand.com", address: "Kelas online & offline (Jakarta)", hours: "Admin online 08.00 - 20.00" },
    cta: { headline: "Mulai Belajar Hari Ini", text: "Kuota per batch terbatas. Amankan tempat Anda sekarang.", buttonText: "Daftar via WhatsApp" },
  },
  {
    id: "properti",
    name: "Properti / Real Estate",
    description: "Agen properti, perumahan, kos — elegan & terpercaya.",
    primary: "#0F766E",
    whatsapp: "+62 812-6666-6666",
    heroImage: "/templates/properti-hero.jpg",
    aboutImage: "/templates/properti-hero.jpg",
    productLabel: "Listing",
    productSubtitle: "Pilihan properti terbaik untuk Anda.",
    hero: { headline: "Temukan Hunian Impian Anda", subheadline: "Pilihan properti terbaik dengan lokasi strategis dan harga bersaing.", ctaText: "Lihat Listing" },
    features: {
      title: "Kenapa Lewat Kami",
      items: [
        { title: "Legalitas Aman", text: "Semua unit bersertifikat & terverifikasi." },
        { title: "Bantuan KPR", text: "Proses cicilan dibantu sampai approve." },
        { title: "Survey Gratis", text: "Antar-jemput lokasi tanpa biaya tambahan." },
      ],
    },
    about: { title: "Tentang Kami", text: "Kami agen properti terpercaya yang mengedepankan transparansi. Ratusan keluarga telah kami bantu menemukan hunian yang tepat dengan proses yang mudah." },
    products: {
      title: "Listing Tersedia",
      items: [
        { name: "Rumah 2 Lantai, Bekasi", price: "Rp 850 jt", desc: "3 KT, 2 KM, SHM, siap huni.", image: "" },
        { name: "Apartemen Studio, Jakarta", price: "Rp 450 jt", desc: "Fully furnished, dekat MRT.", image: "" },
        { name: "Tanah Kavling, Bogor", price: "Rp 300 jt", desc: "Lokasi berkembang, cocok investasi.", image: "" },
        { name: "Ruko 3 Lantai, Depok", price: "Rp 1,2 M", desc: "Pinggir jalan raya, strategis.", image: "" },
      ],
    },
    faqs: [
      { q: "Apakah unit bisa dilihat langsung?", a: "Tentu, kami sediakan survey gratis dengan antar-jemput." },
      { q: "Bagaimana proses KPR?", a: "Tim kami membantu pengajuan hingga approve, termasuk simulasi cicilan." },
      { q: "Apakah legalitasnya aman?", a: "Semua listing sudah kami verifikasi sertifikat dan kelengkapannya." },
      { q: "Bisa nego harga?", a: "Beberapa unit masih bisa dinego. Hubungi agen kami untuk detail." },
      { q: "Apakah melayani sewa juga?", a: "Ya, kami juga melayani sewa rumah, apartemen, dan ruko." },
    ],
    testimonial: { quote: "“Dibantu dari survey sampai akad. Prosesnya cepat dan jelas.”", author: "Keluarga Wijaya" },
    posts: [
      { title: "Tips Membeli Rumah Pertama", date: "Sep 2026", excerpt: "Biar tidak salah langkah.", cover: "", body: "Membeli rumah pertama itu keputusan besar.\n\n## Cek Legalitas\nPastikan sertifikat jelas dan tidak bermasalah.\n\n## Hitung Kemampuan\nSesuaikan cicilan dengan penghasilan Anda." },
      { title: "KPR vs Cash: Mana yang Tepat?", date: "Agu 2026", excerpt: "Pertimbangan sebelum membeli.", cover: "", body: "Keduanya punya kelebihan.\n\nKPR meringankan di awal, cash lebih hemat bunga. Pilih sesuai kondisi keuangan Anda." },
      { title: "Kawasan yang Sedang Berkembang", date: "Jul 2026", excerpt: "Peluang investasi properti.", cover: "", body: "Membeli di kawasan berkembang bisa memberi kenaikan nilai yang menarik. Tanyakan rekomendasi lokasi ke agen kami." },
    ],
    contact: { title: "Hubungi Agen Kami", email: "info@brand.com", address: "Melayani Jabodetabek & sekitarnya", hours: "Senin - Sabtu, 09.00 - 18.00" },
    cta: { headline: "Konsultasi Properti Gratis", text: "Ceritakan kebutuhan Anda, kami carikan yang paling pas.", buttonText: "Konsultasi via WhatsApp" },
  },
];

/** Build a fresh editable multi-page doc from a template. */
export function templateDoc(templateId: string, brand: string): WebsiteDoc | null {
  const t = WEBSITE_TEMPLATES.find((x) => x.id === templateId);
  if (!t) return null;
  return buildDoc(t, brand);
}
