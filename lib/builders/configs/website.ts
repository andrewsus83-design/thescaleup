import type { BuilderConfig } from "@/lib/builders/wizard-types";

export const website: BuilderConfig = {
  "slug": "website",
  "title": "Website Builder",
  "persona": "Sebagai CTO + CMO ScaleUp, wizard ini saya rancang agar UMKM/brand bisa launch website konversi tinggi dalam 4 langkah: input yang dikumpulkan minimal tapi cukup untuk deliverable, sementara pekerjaan teknis berat (SEO, GEO/AI-Search, kecepatan, schema) dikerjakan otomatis oleh tim ScaleUp. Fokusnya: mudah dipakai klien awam, tapi datanya rapi untuk produksi.",
  "steps": [
    {
      "title": "Informasi Brand/Perusahaan",
      "subtitle": "Identitas visual & data brand Anda. Ini jadi fondasi tampilan seluruh website.",
      "fields": [
        {
          "type": "text",
          "label": "Nama Perusahaan",
          "key": "company_name",
          "placeholder": "mis. Kopi Nusantara",
          "hint": "Nama resmi yang tampil di header, footer, dan title website."
        },
        {
          "type": "text",
          "label": "Tagline / Slogan",
          "key": "tagline",
          "placeholder": "mis. Kopi Lokal, Rasa Dunia",
          "hint": "Kalimat singkat penguat brand (opsional tapi disarankan)."
        },
        {
          "type": "textarea",
          "label": "Deskripsi Singkat",
          "key": "brand_description",
          "placeholder": "Ceritakan bisnis Anda dalam 2-3 kalimat: apa yang dijual, untuk siapa, keunggulannya.",
          "hint": "Dipakai untuk section 'Tentang Kami' dan meta description."
        },
        {
          "type": "color",
          "label": "Warna Primer",
          "key": "brand_color_primary",
          "hint": "Warna utama brand — untuk tombol, header, dan aksen dominan."
        },
        {
          "type": "color",
          "label": "Warna Sekunder",
          "key": "brand_color_secondary",
          "hint": "Warna pendukung untuk background section & elemen kedua."
        },
        {
          "type": "color",
          "label": "Warna Aksen",
          "key": "brand_color_accent",
          "hint": "Warna kontras untuk highlight, badge, atau Call-to-Action penting."
        },
        {
          "type": "image",
          "label": "Logo",
          "key": "logo",
          "hint": "Format PNG transparan / SVG disarankan. Kami rapikan versi terang & gelapnya otomatis."
        },
        {
          "type": "select",
          "label": "Font Utama",
          "key": "font_family",
          "hint": "Pilih gaya tipografi. Semua font sudah dioptimasi untuk kecepatan.",
          "options": [
            {
              "value": "inter",
              "label": "Inter",
              "desc": "Modern, bersih, cocok untuk startup & tech."
            },
            {
              "value": "poppins",
              "label": "Poppins",
              "desc": "Geometris & ramah, cocok untuk brand F&B/lifestyle."
            },
            {
              "value": "montserrat",
              "label": "Montserrat",
              "desc": "Tegas & premium, cocok untuk fashion/agency."
            },
            {
              "value": "plus_jakarta_sans",
              "label": "Plus Jakarta Sans",
              "desc": "Nuansa lokal Indonesia, profesional & seimbang."
            },
            {
              "value": "roboto",
              "label": "Roboto",
              "desc": "Netral & sangat mudah dibaca untuk semua industri."
            },
            {
              "value": "lora",
              "label": "Lora (Serif)",
              "desc": "Klasik & elegan, cocok untuk brand mewah/editorial."
            }
          ]
        },
        {
          "type": "url",
          "label": "Instagram",
          "key": "social_instagram",
          "placeholder": "https://instagram.com/brandanda"
        },
        {
          "type": "url",
          "label": "TikTok",
          "key": "social_tiktok",
          "placeholder": "https://tiktok.com/@brandanda"
        },
        {
          "type": "url",
          "label": "Facebook",
          "key": "social_facebook",
          "placeholder": "https://facebook.com/brandanda"
        },
        {
          "type": "url",
          "label": "LinkedIn",
          "key": "social_linkedin",
          "placeholder": "https://linkedin.com/company/brandanda"
        },
        {
          "type": "url",
          "label": "YouTube",
          "key": "social_youtube",
          "placeholder": "https://youtube.com/@brandanda"
        },
        {
          "type": "text",
          "label": "WhatsApp",
          "key": "social_whatsapp",
          "placeholder": "628123456789",
          "hint": "Nomor format internasional tanpa tanda +, mis. 628xxxx."
        }
      ]
    },
    {
      "title": "Halaman & Konten Dasar",
      "subtitle": "Pilih halaman yang dibutuhkan dan isi konten intinya agar tiap halaman langsung optimized.",
      "fields": [
        {
          "type": "multiselect",
          "label": "Halaman yang Dibuat",
          "key": "selected_pages",
          "hint": "Pilih satu atau lebih. Isi field konten di bawah sesuai halaman yang dipilih.",
          "options": [
            {
              "value": "home",
              "label": "Home / Landing",
              "desc": "Halaman utama: hero, value proposition, CTA."
            },
            {
              "value": "products",
              "label": "Products / Service",
              "desc": "Etalase produk atau daftar layanan Anda."
            },
            {
              "value": "faq",
              "label": "FAQ",
              "desc": "Pertanyaan yang sering diajukan pelanggan."
            },
            {
              "value": "contact",
              "label": "Contact Us",
              "desc": "Info kontak, alamat, dan peta lokasi."
            }
          ]
        },
        {
          "type": "text",
          "label": "Headline Home",
          "key": "home_headline",
          "placeholder": "mis. Solusi Kopi Premium untuk Bisnis Anda",
          "hint": "Judul besar di hero — jual manfaat utama, bukan sekadar nama."
        },
        {
          "type": "textarea",
          "label": "Value Proposition (Home)",
          "key": "home_value_proposition",
          "placeholder": "Jelaskan kenapa pelanggan harus pilih Anda — 1-2 kalimat kuat.",
          "hint": "Muncul di bawah headline sebagai penguat."
        },
        {
          "type": "text",
          "label": "Teks Tombol Utama (CTA)",
          "key": "home_cta_label",
          "placeholder": "mis. Pesan Sekarang / Konsultasi Gratis",
          "hint": "Ajakan aksi utama di hero."
        },
        {
          "type": "textarea",
          "label": "Daftar Produk / Jasa",
          "key": "products_list",
          "placeholder": "Satu produk/jasa per baris. Format: Nama - Deskripsi singkat - Harga (opsional)",
          "hint": "Isi jika memilih halaman Products/Service."
        },
        {
          "type": "textarea",
          "label": "Item FAQ",
          "key": "faq_items",
          "placeholder": "Format per baris: Pertanyaan | Jawaban",
          "hint": "Isi jika memilih halaman FAQ. Kami ubah jadi schema FAQ otomatis."
        },
        {
          "type": "text",
          "label": "Email Kontak",
          "key": "contact_email",
          "placeholder": "halo@brandanda.com"
        },
        {
          "type": "text",
          "label": "Telepon / WhatsApp",
          "key": "contact_phone",
          "placeholder": "628123456789"
        },
        {
          "type": "textarea",
          "label": "Alamat",
          "key": "contact_address",
          "placeholder": "Jl. Contoh No. 123, Kota, Provinsi, Kode Pos",
          "hint": "Isi jika memilih halaman Contact Us."
        },
        {
          "type": "url",
          "label": "Link Google Maps",
          "key": "contact_maps_url",
          "placeholder": "https://maps.google.com/...",
          "hint": "Tempel link lokasi agar peta tampil otomatis."
        }
      ]
    },
    {
      "title": "Integrasi",
      "subtitle": "Aktifkan tools yang Anda butuhkan. Cukup nyalakan toggle lalu isi data terkait.",
      "fields": [
        {
          "type": "toggle",
          "label": "Tombol WhatsApp Mengambang",
          "key": "integ_whatsapp",
          "hint": "Chat langsung ke bisnis Anda dari semua halaman."
        },
        {
          "type": "text",
          "label": "Nomor WhatsApp",
          "key": "whatsapp_number",
          "placeholder": "628123456789",
          "hint": "Aktif jika toggle WhatsApp dinyalakan."
        },
        {
          "type": "text",
          "label": "Pesan Default WhatsApp",
          "key": "whatsapp_default_message",
          "placeholder": "mis. Halo, saya mau tanya soal produk Anda",
          "hint": "Teks otomatis saat pelanggan klik tombol."
        },
        {
          "type": "toggle",
          "label": "Google Analytics (GA4)",
          "key": "integ_google_analytics",
          "hint": "Lacak trafik & perilaku pengunjung."
        },
        {
          "type": "text",
          "label": "GA4 Measurement ID",
          "key": "ga_measurement_id",
          "placeholder": "G-XXXXXXXXXX"
        },
        {
          "type": "toggle",
          "label": "Meta Pixel",
          "key": "integ_meta_pixel",
          "hint": "Untuk retargeting iklan Facebook & Instagram."
        },
        {
          "type": "text",
          "label": "Meta Pixel ID",
          "key": "meta_pixel_id",
          "placeholder": "mis. 123456789012345"
        },
        {
          "type": "toggle",
          "label": "Live Chat",
          "key": "integ_live_chat",
          "hint": "Widget chat real-time di website."
        },
        {
          "type": "select",
          "label": "Provider Live Chat",
          "key": "live_chat_provider",
          "hint": "Aktif jika Live Chat dinyalakan.",
          "options": [
            {
              "value": "tawkto",
              "label": "Tawk.to",
              "desc": "Gratis & populer untuk UMKM."
            },
            {
              "value": "crisp",
              "label": "Crisp",
              "desc": "Modern, fitur lengkap."
            },
            {
              "value": "chatway",
              "label": "Chatway",
              "desc": "Ringan & mudah setup."
            }
          ]
        },
        {
          "type": "text",
          "label": "Widget / Property ID Live Chat",
          "key": "live_chat_widget_id",
          "placeholder": "Tempel ID dari dashboard provider"
        },
        {
          "type": "toggle",
          "label": "Payment Link",
          "key": "integ_payment_link",
          "hint": "Terima pembayaran langsung tanpa toko online."
        },
        {
          "type": "url",
          "label": "URL Payment Link",
          "key": "payment_link_url",
          "placeholder": "https://payment.xendit.co/... atau link Midtrans",
          "hint": "Link dari Xendit/Midtrans/lainnya."
        },
        {
          "type": "toggle",
          "label": "Booking / Reservasi",
          "key": "integ_booking",
          "hint": "Jadwalkan janji temu atau reservasi."
        },
        {
          "type": "url",
          "label": "URL Booking",
          "key": "booking_url",
          "placeholder": "https://calendly.com/... atau link booking lainnya"
        }
      ]
    },
    {
      "title": "Optimasi Otomatis oleh ScaleUp",
      "subtitle": "Tidak ada yang perlu Anda isi. Tim ScaleUp menerapkan optimasi ini otomatis sebelum website live.",
      "auto": true,
      "fields": [
        {
          "type": "info",
          "label": "SEO Teknis & On-Page",
          "key": "info_seo",
          "hint": "Meta title & description tiap halaman, struktur heading, sitemap.xml, robots.txt, alt text gambar, internal linking, dan schema markup (Organization, Product, FAQ, LocalBusiness) diterapkan otomatis agar mudah ditemukan di Google."
        },
        {
          "type": "info",
          "label": "GEO / AI-Search Optimization",
          "key": "info_geo_ai_search",
          "hint": "Konten distruktur agar mudah dikutip oleh AI seperti ChatGPT, Gemini, & Perplexity: penulisan berbasis entitas, FAQ terstruktur, ringkasan jawaban langsung, dan data brand yang jelas untuk meningkatkan peluang citation."
        },
        {
          "type": "info",
          "label": "Kecepatan & Core Web Vitals",
          "key": "info_speed",
          "hint": "Kompresi & lazy-load gambar (WebP/AVIF), minifikasi kode, caching, dan optimasi font agar skor Core Web Vitals (LCP, CLS, INP) hijau di mobile maupun desktop."
        },
        {
          "type": "info",
          "label": "Social & Sharing Optimization",
          "key": "info_social",
          "hint": "Open Graph & Twitter Card diset otomatis agar tampilan link rapi saat dibagikan di WhatsApp, Instagram, Facebook, & LinkedIn — lengkap dengan gambar preview dan favicon brand."
        },
        {
          "type": "info",
          "label": "Mobile-First, HTTPS & Aksesibilitas",
          "key": "info_mobile_security",
          "hint": "Desain responsif mobile-first, sertifikat SSL/HTTPS, kontras warna sesuai standar aksesibilitas, dan pemeriksaan lintas-browser sebelum website dipublikasikan."
        }
      ]
    }
  ],
  "suggestions": [
    "Jadikan hasil wizard sebagai 'brief otomatis': generate preview website + draft konten via AI dari input klien, lalu tim ScaleUp tinggal poles — pangkas waktu produksi dan biaya per proyek.",
    "Tambahkan step opsional 'Import dari Instagram/Google Business': tarik logo, warna dominan, foto produk, dan alamat otomatis agar klien makin cepat mengisi dan drop-off menurun.",
    "Bangun model RECURRING: paket bulanan (hosting + domain + maintenance + update konten + laporan SEO/Analytics) sehingga website bukan proyek sekali bayar, tapi langganan yang memberi MRR stabil.",
    "Kunci nilai di Step 4 (Optimasi Otomatis) sebagai pembeda berbayar — jual sebagai 'SEO & AI-Search Care' add-on bulanan dengan laporan ranking & citation AI tiap bulan.",
    "Tambahkan upsell di akhir wizard: integrasi CRM/WhatsApp API, katalog e-commerce, dan A/B testing landing page — plus template industri (F&B, jasa, fashion) agar wizard bisa dipakai ulang & di-scale ke banyak klien."
  ]
};
