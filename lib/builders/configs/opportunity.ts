import type { BuilderConfig } from "@/lib/builders/wizard-types";

export const opportunity: BuilderConfig = {
  "slug": "opportunity",
  "title": "Opportunity Finder",
  "persona": "CBO + Analytic ScaleUp — berpikir dari sisi pertumbuhan bisnis (unit economics, positioning, prioritas peluang) sekaligus berbasis data (gap analysis, tren, impact vs effort). Wizard dirancang agar klien UMKM cukup isi konteks bisnis, sisanya (analisis & rekomendasi) dikerjakan tim ScaleUp sebagai deliverable.",
  "steps": [
    {
      "title": "Profil Bisnis & Target Pasar",
      "subtitle": "Ceritakan kondisi bisnis Anda sekarang. Ini jadi dasar analisis peluang yang akurat.",
      "fields": [
        {
          "type": "text",
          "label": "Nama Bisnis / Brand",
          "key": "business_name",
          "placeholder": "Contoh: Kopi Nusantara"
        },
        {
          "type": "url",
          "label": "Website / Link Toko Online",
          "key": "business_link",
          "placeholder": "https://...",
          "hint": "Boleh website, marketplace (Shopee/Tokopedia), atau IG Shop. Kami pakai untuk scrape & analisis otomatis."
        },
        {
          "type": "cards",
          "label": "Industri / Kategori Bisnis",
          "key": "industry",
          "options": [
            {
              "value": "fnb",
              "label": "F&B / Kuliner",
              "desc": "Makanan, minuman, catering, FMCG"
            },
            {
              "value": "fashion",
              "label": "Fashion & Apparel",
              "desc": "Pakaian, aksesoris, sepatu, tas"
            },
            {
              "value": "beauty",
              "label": "Kecantikan & Perawatan",
              "desc": "Skincare, kosmetik, personal care"
            },
            {
              "value": "health",
              "label": "Kesehatan & Wellness",
              "desc": "Suplemen, herbal, fitness, klinik"
            },
            {
              "value": "service",
              "label": "Jasa & Layanan",
              "desc": "Agency, konsultan, service B2B/B2C"
            },
            {
              "value": "education",
              "label": "Edukasi & Kursus",
              "desc": "Course, bimbel, workshop, konten"
            },
            {
              "value": "craft_home",
              "label": "Kerajinan & Home Decor",
              "desc": "Handmade, furniture, dekorasi"
            },
            {
              "value": "tech_digital",
              "label": "Teknologi / Digital",
              "desc": "SaaS, aplikasi, produk digital"
            },
            {
              "value": "other",
              "label": "Lainnya",
              "desc": "Sebutkan di deskripsi target pasar"
            }
          ]
        },
        {
          "type": "radio",
          "label": "Tahap Bisnis Saat Ini",
          "key": "business_stage",
          "options": [
            {
              "value": "startup",
              "label": "Baru mulai (< 1 tahun)"
            },
            {
              "value": "growing",
              "label": "Berkembang (1–3 tahun)"
            },
            {
              "value": "established",
              "label": "Stabil (3–5 tahun)"
            },
            {
              "value": "mature",
              "label": "Mapan (> 5 tahun)"
            }
          ]
        },
        {
          "type": "select",
          "label": "Rentang Omzet Bulanan",
          "key": "monthly_revenue",
          "hint": "Untuk estimasi potensi revenue tiap peluang. Data dijaga rahasia.",
          "options": [
            {
              "value": "u10",
              "label": "< Rp 10 juta"
            },
            {
              "value": "10_50",
              "label": "Rp 10 – 50 juta"
            },
            {
              "value": "50_200",
              "label": "Rp 50 – 200 juta"
            },
            {
              "value": "200_1b",
              "label": "Rp 200 juta – 1 miliar"
            },
            {
              "value": "o1b",
              "label": "> Rp 1 miliar"
            }
          ]
        },
        {
          "type": "textarea",
          "label": "Deskripsi Target Pasar / Pelanggan Utama",
          "key": "target_market_desc",
          "placeholder": "Contoh: Wanita 25–35th di kota besar, pekerja kantoran, cari kopi praktis premium untuk di rumah.",
          "hint": "Siapa yang beli? Usia, lokasi, pekerjaan, kebiasaan, alasan beli."
        },
        {
          "type": "multiselect",
          "label": "Segmen Pelanggan yang Disasar",
          "key": "customer_segments",
          "options": [
            {
              "value": "genz",
              "label": "Gen Z (18–26)"
            },
            {
              "value": "millennial",
              "label": "Milenial (27–42)"
            },
            {
              "value": "genx",
              "label": "Gen X / dewasa (43+)"
            },
            {
              "value": "parents",
              "label": "Orang tua / keluarga"
            },
            {
              "value": "professional",
              "label": "Profesional / pekerja"
            },
            {
              "value": "umkm_reseller",
              "label": "UMKM / reseller (B2B)"
            },
            {
              "value": "corporate",
              "label": "Korporat / instansi (B2B)"
            }
          ]
        },
        {
          "type": "multiselect",
          "label": "Cakupan Geografis Saat Ini",
          "key": "geographic_focus",
          "options": [
            {
              "value": "local_city",
              "label": "Lokal (1 kota)"
            },
            {
              "value": "jabodetabek",
              "label": "Jabodetabek"
            },
            {
              "value": "java",
              "label": "Pulau Jawa"
            },
            {
              "value": "national",
              "label": "Nasional"
            },
            {
              "value": "export",
              "label": "Ekspor / luar negeri"
            }
          ]
        },
        {
          "type": "textarea",
          "label": "Produk / Layanan Saat Ini + Kisaran Harga",
          "key": "current_products",
          "placeholder": "Contoh: Kopi drip bag (Rp 45rb/box), biji kopi 200gr (Rp 120rb), langganan bulanan (Rp 300rb).",
          "hint": "Sebutkan produk best-seller dan harganya agar kami paham struktur offer & margin."
        },
        {
          "type": "multiselect",
          "label": "Channel Penjualan & Marketing yang Aktif",
          "key": "active_channels",
          "options": [
            {
              "value": "instagram",
              "label": "Instagram"
            },
            {
              "value": "tiktok",
              "label": "TikTok / TikTok Shop"
            },
            {
              "value": "marketplace",
              "label": "Marketplace (Shopee/Tokopedia)"
            },
            {
              "value": "whatsapp",
              "label": "WhatsApp / chat"
            },
            {
              "value": "website",
              "label": "Website / toko sendiri"
            },
            {
              "value": "offline",
              "label": "Toko / booth offline"
            },
            {
              "value": "reseller",
              "label": "Reseller / distributor"
            },
            {
              "value": "ads",
              "label": "Iklan berbayar (Meta/Google/TikTok Ads)"
            }
          ]
        }
      ]
    },
    {
      "title": "Kompetitor, Diferensiasi & Arah Peluang",
      "subtitle": "Bantu kami memetakan lanskap kompetisi dan arah peluang yang paling Anda inginkan.",
      "fields": [
        {
          "type": "textarea",
          "label": "Kompetitor Utama (nama + link bila ada)",
          "key": "known_competitors",
          "placeholder": "Contoh: Brand A (ig.com/brandA), Brand B (shopee link), Brand C",
          "hint": "3–5 kompetitor langsung/tidak langsung. Kami analisis positioning & harga mereka."
        },
        {
          "type": "textarea",
          "label": "Keunggulan / Pembeda Anda Saat Ini",
          "key": "current_differentiation",
          "placeholder": "Contoh: Single origin lokal, kemasan eco, harga lebih terjangkau dari kompetitor premium."
        },
        {
          "type": "textarea",
          "label": "Keluhan / Kebutuhan Pelanggan yang Belum Terpenuhi",
          "key": "customer_pain_points",
          "placeholder": "Contoh: Pelanggan mau porsi lebih kecil untuk coba, sering tanya varian rendah kafein.",
          "hint": "Sering muncul dari komentar, chat, atau review. Ini sumber peluang terkuat."
        },
        {
          "type": "multiselect",
          "label": "Jenis Peluang yang Ingin Dieksplorasi",
          "key": "opportunity_type",
          "hint": "Pilih beberapa. Kami prioritaskan ide sesuai arah ini.",
          "options": [
            {
              "value": "new_product",
              "label": "Produk baru",
              "desc": "Lini/varian yang belum ada"
            },
            {
              "value": "bundling",
              "label": "Bundling / paket",
              "desc": "Gabungan produk untuk naikkan AOV"
            },
            {
              "value": "new_segment",
              "label": "Segmen pelanggan baru",
              "desc": "Menyasar audiens berbeda"
            },
            {
              "value": "new_channel",
              "label": "Channel baru",
              "desc": "TikTok Shop, offline, B2B, dll"
            },
            {
              "value": "pricing_model",
              "label": "Model harga / langganan",
              "desc": "Subscription, tier, membership"
            },
            {
              "value": "geo_expansion",
              "label": "Ekspansi geografis",
              "desc": "Kota/wilayah/ekspor baru"
            },
            {
              "value": "collab",
              "label": "Kolaborasi / co-branding",
              "desc": "Partner brand atau komunitas"
            }
          ]
        },
        {
          "type": "select",
          "label": "Budget untuk Inisiatif Baru",
          "key": "budget_range",
          "options": [
            {
              "value": "u5",
              "label": "< Rp 5 juta"
            },
            {
              "value": "5_25",
              "label": "Rp 5 – 25 juta"
            },
            {
              "value": "25_100",
              "label": "Rp 25 – 100 juta"
            },
            {
              "value": "o100",
              "label": "> Rp 100 juta"
            },
            {
              "value": "flexible",
              "label": "Fleksibel / tergantung potensi"
            }
          ]
        },
        {
          "type": "radio",
          "label": "Selera Risiko",
          "key": "risk_appetite",
          "options": [
            {
              "value": "conservative",
              "label": "Konservatif",
              "desc": "Peluang aman, cepat balik modal"
            },
            {
              "value": "moderate",
              "label": "Moderat",
              "desc": "Seimbang risiko & potensi"
            },
            {
              "value": "aggressive",
              "label": "Agresif",
              "desc": "Berani taruhan besar untuk lompatan"
            }
          ]
        },
        {
          "type": "select",
          "label": "Target Waktu Eksekusi",
          "key": "target_timeline",
          "options": [
            {
              "value": "1m",
              "label": "Secepatnya (≤ 1 bulan)"
            },
            {
              "value": "1_3m",
              "label": "1 – 3 bulan"
            },
            {
              "value": "3_6m",
              "label": "3 – 6 bulan"
            },
            {
              "value": "o6m",
              "label": "> 6 bulan"
            }
          ]
        },
        {
          "type": "textarea",
          "label": "Batasan / Hal yang Harus Dihindari (opsional)",
          "key": "constraints",
          "placeholder": "Contoh: Kapasitas produksi terbatas, tidak mau bakar uang untuk diskon besar.",
          "hint": "Misal keterbatasan produksi, stok, SDM, regulasi, atau value brand."
        }
      ]
    },
    {
      "title": "Analisis Gap, Kompetitor & Tren Pasar",
      "subtitle": "Dikerjakan otomatis oleh tim ScaleUp — Anda tidak perlu mengisi apa pun.",
      "auto": true,
      "fields": [
        {
          "type": "info",
          "label": "Apa yang kami kerjakan di tahap ini",
          "hint": "Berdasarkan input Anda, tim CBO + Analytic ScaleUp menyusun Market Opportunity Report: (1) scrape & audit website/marketplace/sosmed Anda dan kompetitor, (2) competitor positioning & pricing map, (3) gap analysis — kebutuhan pasar yang belum digarap, (4) sinyal permintaan & tren (Google Trends, marketplace, sosial), (5) estimasi ukuran pasar (TAM/SAM) untuk fokus Anda. Output: dokumen ringkas berisi temuan kunci + 3–5 celah peluang paling menjanjikan. Estimasi 2–3 hari kerja."
        }
      ]
    },
    {
      "title": "Ide Offer Baru, Validasi & Prioritas (Impact vs Effort)",
      "subtitle": "Deliverable akhir dari tim ScaleUp — peta peluang siap eksekusi.",
      "auto": true,
      "fields": [
        {
          "type": "info",
          "label": "Deliverable yang Anda terima",
          "hint": "Dari hasil analisis, tim ScaleUp menghasilkan Opportunity Roadmap: (1) 5–10 ide offer/produk/bundling baru sesuai arah & budget Anda, masing-masing dengan value proposition, target segmen, dan estimasi potensi revenue; (2) validasi ringan tiap ide terhadap sinyal permintaan & kesiapan Anda; (3) Prioritization Matrix Impact vs Effort untuk memetakan mana quick-win vs big-bet; (4) rekomendasi Top 3 peluang lengkap dengan mini go-to-market plan, kebutuhan sumber daya, dan KPI/target 90 hari. Output: presentasi + matriks interaktif. Estimasi 2–3 hari kerja setelah analisis."
        }
      ]
    }
  ],
  "suggestions": [
    "Jadikan RECURRING sebagai 'Opportunity Radar' — langganan bulanan/kuartalan yang otomatis re-run analisis gap & tren, lalu kirim 3 peluang baru tiap periode. Ubah proyek sekali jadi retainer.",
    "Integrasikan data real (Google Trends, Meta Ads Library, scraping marketplace) ke Step 3 agar gap analysis lebih akurat dan sebagian otomatis — kurangi jam kerja analis per klien.",
    "Pakai LLM untuk generate draft ide di Step 4 dari gabungan input + hasil scrape, lalu tim validasi manual (hybrid). Ini memungkinkan skala banyak klien tanpa menurunkan kualitas.",
    "Tambah step 'Tracking & Eksekusi' opsional: simpan roadmap sebagai baseline, ukur ide yang dijalankan vs proyeksi impact — jadi pintu upsell ke paket eksekusi/growth retainer.",
    "Buat Prioritization Matrix Impact vs Effort interaktif (slider bobot) agar klien ikut 'bermain' menyusun prioritas sendiri — menaikkan engagement, ownership, dan perceived value deliverable."
  ]
};
