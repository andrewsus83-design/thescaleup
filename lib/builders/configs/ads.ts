import type { BuilderConfig } from "@/lib/builders/wizard-types";

export const ads: BuilderConfig = {
  "slug": "ads",
  "title": "Ads & Campaign",
  "persona": "CMO + Analytic ScaleUp — spesialis growth performance marketing untuk UMKM & brand Indonesia. Fokus: keputusan berbasis data (baseline, ROAS, CPL/CPA), riset audiens & angle yang tajam, setup teknis yang rapi (pixel, tracking, budget), dan pelaporan yang actionable, bukan sekadar angka.",
  "steps": [
    {
      "title": "Analytic & Objektif",
      "subtitle": "Kita mulai dari data & tujuan. Angka baseline ini jadi dasar kami menghitung target realistis dan mengukur keberhasilan kampanye.",
      "fields": [
        {
          "type": "text",
          "label": "Nama Brand / Bisnis",
          "key": "brand_name",
          "placeholder": "cth. Kopi Nusantara"
        },
        {
          "type": "select",
          "label": "Industri / Kategori",
          "key": "industry",
          "hint": "Membantu kami benchmark ROAS & CPL wajar untuk niche Anda",
          "options": [
            {
              "value": "fnb",
              "label": "F&B / Kuliner"
            },
            {
              "value": "fashion",
              "label": "Fashion & Apparel"
            },
            {
              "value": "beauty",
              "label": "Kecantikan / Skincare"
            },
            {
              "value": "health",
              "label": "Kesehatan & Wellness"
            },
            {
              "value": "service",
              "label": "Jasa / Service"
            },
            {
              "value": "education",
              "label": "Edukasi / Kursus"
            },
            {
              "value": "property",
              "label": "Properti"
            },
            {
              "value": "digital",
              "label": "Digital Product / SaaS"
            },
            {
              "value": "other",
              "label": "Lainnya"
            }
          ]
        },
        {
          "type": "textarea",
          "label": "Produk / Layanan yang Diiklankan",
          "key": "product_service",
          "placeholder": "Jelaskan singkat produk unggulan, harga, dan cara transaksi (checkout web / WA / marketplace)"
        },
        {
          "type": "text",
          "label": "Rata-rata Nilai Transaksi (AOV)",
          "key": "avg_order_value",
          "placeholder": "cth. Rp 250.000",
          "hint": "Dipakai untuk kalkulasi target ROAS & break-even CPA"
        },
        {
          "type": "text",
          "label": "Omzet Bulanan Saat Ini",
          "key": "baseline_monthly_revenue",
          "placeholder": "cth. Rp 50.000.000",
          "hint": "Perkiraan tidak apa-apa"
        },
        {
          "type": "text",
          "label": "Ad Spend Bulanan Saat Ini",
          "key": "current_ad_spend",
          "placeholder": "cth. Rp 5.000.000 (kosongkan jika belum pernah)"
        },
        {
          "type": "text",
          "label": "ROAS Saat Ini (jika ada)",
          "key": "current_roas",
          "placeholder": "cth. 2.5",
          "hint": "Kosongkan bila belum pernah beriklan berbayar"
        },
        {
          "type": "cards",
          "label": "Tujuan Utama Kampanye",
          "key": "campaign_objective",
          "hint": "Pilih satu fokus utama — struktur kampanye kami sesuaikan dari sini",
          "options": [
            {
              "value": "awareness",
              "label": "Brand Awareness",
              "desc": "Dikenal audiens baru, jangkauan & impresi maksimal"
            },
            {
              "value": "traffic",
              "label": "Traffic",
              "desc": "Datangkan pengunjung ke web / landing page / profil"
            },
            {
              "value": "leads",
              "label": "Lead Generation",
              "desc": "Kumpulkan calon pelanggan (form, WA, DB kontak)"
            },
            {
              "value": "conversion",
              "label": "Sales / Conversion",
              "desc": "Fokus pembelian & ROAS — paling umum untuk UMKM"
            },
            {
              "value": "retargeting",
              "label": "Retargeting / Retensi",
              "desc": "Konversi ulang pengunjung & pelanggan lama"
            }
          ]
        },
        {
          "type": "text",
          "label": "Target ROAS",
          "key": "target_roas",
          "placeholder": "cth. 4 (artinya Rp1 iklan → Rp4 penjualan)",
          "hint": "Kosongkan bila belum yakin, kami usulkan angka wajar"
        },
        {
          "type": "text",
          "label": "Target CPL / CPA",
          "key": "target_cpl_cpa",
          "placeholder": "cth. Rp 30.000 per lead / Rp 100.000 per sale"
        },
        {
          "type": "text",
          "label": "Rencana Budget Iklan / Bulan",
          "key": "monthly_ad_budget",
          "placeholder": "cth. Rp 10.000.000",
          "hint": "Di luar management fee"
        },
        {
          "type": "url",
          "label": "URL Tujuan (Landing Page / Toko / WA)",
          "key": "destination_url",
          "placeholder": "https://... atau link wa.me"
        },
        {
          "type": "multiselect",
          "label": "KPI yang Ingin Dipantau",
          "key": "primary_kpi",
          "hint": "Kami tampilkan metrik ini di report",
          "options": [
            {
              "value": "roas",
              "label": "ROAS"
            },
            {
              "value": "cpl",
              "label": "CPL (Cost per Lead)"
            },
            {
              "value": "cpa",
              "label": "CPA / CPP (Cost per Purchase)"
            },
            {
              "value": "ctr",
              "label": "CTR"
            },
            {
              "value": "cpm",
              "label": "CPM"
            },
            {
              "value": "conversions",
              "label": "Jumlah Konversi / Sales"
            },
            {
              "value": "reach",
              "label": "Reach / Impressions"
            }
          ]
        }
      ]
    },
    {
      "title": "Research & Strategi",
      "subtitle": "Semakin dalam kami paham audiens & kompetitor Anda, semakin tajam angle iklannya. Input Anda kami kembangkan jadi strategi lengkap.",
      "fields": [
        {
          "type": "textarea",
          "label": "Deskripsi Target Audiens",
          "key": "target_audience",
          "placeholder": "Usia, gender, pekerjaan, minat, dan terutama masalah / kebutuhan mereka"
        },
        {
          "type": "select",
          "label": "Rentang Usia Utama",
          "key": "age_range",
          "options": [
            {
              "value": "18_24",
              "label": "18–24 tahun"
            },
            {
              "value": "25_34",
              "label": "25–34 tahun"
            },
            {
              "value": "35_44",
              "label": "35–44 tahun"
            },
            {
              "value": "45_54",
              "label": "45–54 tahun"
            },
            {
              "value": "55_plus",
              "label": "55+ tahun"
            },
            {
              "value": "mixed",
              "label": "Campuran / belum yakin"
            }
          ]
        },
        {
          "type": "text",
          "label": "Area / Kota Target",
          "key": "location_target",
          "placeholder": "cth. Jabodetabek, Bandung, Surabaya, atau Nasional"
        },
        {
          "type": "textarea",
          "label": "Kompetitor Utama",
          "key": "competitors",
          "placeholder": "Nama brand + link IG/TikTok/website. Kami bedah iklan mereka via Ads Library"
        },
        {
          "type": "textarea",
          "label": "Keunggulan Utama (USP)",
          "key": "usp",
          "placeholder": "Kenapa orang harus beli dari Anda, bukan kompetitor? (harga, kualitas, garansi, kecepatan, dll)"
        },
        {
          "type": "multiselect",
          "label": "Angle Iklan yang Ingin Dicoba",
          "key": "preferred_angles",
          "hint": "Kami tetap uji beberapa angle, ini prioritas Anda",
          "options": [
            {
              "value": "promo",
              "label": "Diskon / Promo",
              "desc": "Dorong pembelian dengan penawaran"
            },
            {
              "value": "social_proof",
              "label": "Testimoni / Social Proof",
              "desc": "Bukti dari pelanggan lain"
            },
            {
              "value": "problem_solution",
              "label": "Problem–Solution / Edukasi",
              "desc": "Angkat masalah, tawarkan solusi"
            },
            {
              "value": "urgency",
              "label": "Urgency / Scarcity",
              "desc": "Stok/waktu terbatas"
            },
            {
              "value": "lifestyle",
              "label": "Lifestyle / Aspirational",
              "desc": "Jual gaya hidup & aspirasi"
            },
            {
              "value": "value",
              "label": "Value / Harga",
              "desc": "Tekankan worth-it & benefit"
            }
          ]
        },
        {
          "type": "radio",
          "label": "Ketersediaan Materi Kreatif",
          "key": "creative_status",
          "options": [
            {
              "value": "ready",
              "label": "Sudah ada",
              "desc": "Foto/video/copy siap pakai"
            },
            {
              "value": "partial",
              "label": "Sebagian ada",
              "desc": "Perlu diolah / dilengkapi"
            },
            {
              "value": "none",
              "label": "Belum ada",
              "desc": "Minta ScaleUp produksi (add-on)"
            }
          ]
        },
        {
          "type": "select",
          "label": "Tone / Gaya Komunikasi Brand",
          "key": "brand_tone",
          "options": [
            {
              "value": "friendly",
              "label": "Santai & Akrab"
            },
            {
              "value": "professional",
              "label": "Profesional & Terpercaya"
            },
            {
              "value": "fun",
              "label": "Fun & Playful"
            },
            {
              "value": "premium",
              "label": "Premium & Elegan"
            },
            {
              "value": "bold",
              "label": "Bold & Hard-selling"
            }
          ]
        },
        {
          "type": "info",
          "label": "Yang ScaleUp kerjakan dari input ini",
          "key": "research_scope_info",
          "hint": "Tim kami menambah: riset keyword & interest targeting, audience persona + lookalike/custom audience, teardown iklan kompetitor (Meta/TikTok Ads Library), serta matriks angle × format untuk A/B testing. Anda tidak perlu mengisi bagian ini."
        }
      ]
    },
    {
      "title": "Integrasi & Setup Kampanye",
      "subtitle": "Bagian teknis: akun iklan, tracking, budget, dan jadwal. Cukup beri akses — jangan pernah bagikan password Anda ke siapa pun.",
      "fields": [
        {
          "type": "multiselect",
          "label": "Platform Iklan",
          "key": "ad_platforms",
          "hint": "Pilih channel yang ingin dijalankan",
          "options": [
            {
              "value": "meta",
              "label": "Meta Ads",
              "desc": "Facebook & Instagram"
            },
            {
              "value": "google",
              "label": "Google Ads",
              "desc": "Search, Display, YouTube, PMax"
            },
            {
              "value": "tiktok",
              "label": "TikTok Ads",
              "desc": "Video-first, audiens muda"
            }
          ]
        },
        {
          "type": "radio",
          "label": "Status Akun Iklan",
          "key": "account_access_status",
          "hint": "ScaleUp akses via partner/Business Manager — bukan lewat password Anda",
          "options": [
            {
              "value": "granted",
              "label": "Sudah beri akses partner ke ScaleUp"
            },
            {
              "value": "will_grant",
              "label": "Punya akun, akan beri akses"
            },
            {
              "value": "need_setup",
              "label": "Belum punya, minta dibuatkan (dimiliki atas nama Anda)"
            }
          ]
        },
        {
          "type": "text",
          "label": "Business Manager / Ad Account ID",
          "key": "business_manager_id",
          "placeholder": "cth. ID BM Meta / Google Ads Customer ID",
          "hint": "Untuk kami kirim permintaan akses partner. JANGAN isi password"
        },
        {
          "type": "radio",
          "label": "Status Pixel / Tracking",
          "key": "pixel_tracking_status",
          "options": [
            {
              "value": "installed",
              "label": "Sudah terpasang & aktif"
            },
            {
              "value": "not_installed",
              "label": "Belum terpasang"
            },
            {
              "value": "unsure",
              "label": "Tidak yakin — minta dicek ScaleUp"
            }
          ]
        },
        {
          "type": "multiselect",
          "label": "Event Konversi yang Dilacak",
          "key": "conversion_events",
          "hint": "Sesuaikan dengan tujuan kampanye",
          "options": [
            {
              "value": "purchase",
              "label": "Purchase"
            },
            {
              "value": "lead",
              "label": "Lead / Form Submit"
            },
            {
              "value": "add_to_cart",
              "label": "Add to Cart"
            },
            {
              "value": "initiate_checkout",
              "label": "Initiate Checkout"
            },
            {
              "value": "view_content",
              "label": "View Content"
            },
            {
              "value": "contact",
              "label": "Contact / Chat WA"
            }
          ]
        },
        {
          "type": "text",
          "label": "Total Budget Kampanye",
          "key": "total_budget",
          "placeholder": "cth. Rp 15.000.000 untuk periode ini"
        },
        {
          "type": "text",
          "label": "Budget Harian (opsional)",
          "key": "daily_budget",
          "placeholder": "cth. Rp 500.000 / hari",
          "hint": "Kosongkan bila mau kami yang atur pacing"
        },
        {
          "type": "textarea",
          "label": "Alokasi Budget per Platform (opsional)",
          "key": "budget_split",
          "placeholder": "cth. Meta 60% / TikTok 30% / Google 10%. Kosongkan → kami rekomendasikan"
        },
        {
          "type": "text",
          "label": "Tanggal Mulai",
          "key": "schedule_start",
          "placeholder": "cth. 15 September 2026"
        },
        {
          "type": "select",
          "label": "Durasi Kampanye",
          "key": "campaign_duration",
          "options": [
            {
              "value": "1m",
              "label": "1 Bulan (pilot / testing)"
            },
            {
              "value": "3m",
              "label": "3 Bulan"
            },
            {
              "value": "6m",
              "label": "6 Bulan"
            },
            {
              "value": "ongoing",
              "label": "Ongoing / Retainer"
            }
          ]
        },
        {
          "type": "info",
          "label": "Catatan Keamanan Akses",
          "key": "security_note",
          "hint": "Untuk keamanan, ScaleUp TIDAK meminta password akun Anda. Akses diberikan lewat Partner Access (Meta Business Manager) atau undangan Google Ads Manager (MCC), sehingga Anda tetap memegang penuh kepemilikan akun & metode pembayaran."
        }
      ]
    },
    {
      "title": "Report & Optimasi",
      "subtitle": "Bagian ini dikerjakan otomatis oleh tim & sistem ScaleUp. Anda cukup menerima hasilnya — kami tarik data, analisis, dan beri rekomendasi.",
      "auto": true,
      "fields": [
        {
          "type": "info",
          "label": "Metrik yang Dilaporkan",
          "key": "report_metrics",
          "hint": "Spend, ROAS, CPL/CPA, CPM, CTR, jumlah konversi & revenue, plus breakdown per platform, per campaign, dan per creative/angle terbaik vs terburuk."
        },
        {
          "type": "info",
          "label": "Ritme Pelaporan",
          "key": "report_cadence",
          "hint": "Update ringkas mingguan (progres vs target) + laporan strategis bulanan (analisis mendalam & rencana bulan berikutnya). Dashboard real-time dapat diakses kapan saja."
        },
        {
          "type": "info",
          "label": "Optimasi Rutin",
          "key": "optimization_actions",
          "hint": "Kami lakukan scaling budget pada iklan menang, matikan iklan boros, uji creative & audience baru, refresh angle saat kelelahan (ad fatigue), dan jaga CPL/ROAS di target."
        },
        {
          "type": "info",
          "label": "Rekomendasi & Next Step",
          "key": "recommendations",
          "hint": "Setiap laporan memuat insight actionable: alokasi budget berikutnya, ide creative/angle baru, peluang channel tambahan, dan proyeksi hasil bila budget di-scale."
        },
        {
          "type": "info",
          "label": "Cara Menerima Laporan",
          "key": "delivery_channel",
          "hint": "Dikirim via email + WhatsApp dalam format ringkas, plus tautan dashboard interaktif. Sesi review bulanan bersama tim ScaleUp bila diperlukan."
        }
      ]
    }
  ],
  "suggestions": [
    "Integrasikan langsung Meta Marketing API & Google Ads API supaya data spend/ROAS/CPL masuk otomatis ke Step 4 — hilangkan input manual dan report jadi real-time, ini pembeda utama vs agency biasa.",
    "Jadikan Report sebagai dashboard live (mis. embed Looker Studio) + auto-generate rekomendasi mingguan pakai LLM dari data kampanye. Ini fondasi paket RETAINER bulanan yang recurring, bukan proyek sekali jalan.",
    "Simpan baseline & hasil tiap bulan per klien untuk benchmarking per industri, lalu tampilkan grafik improvement bulan-ke-bulan di dashboard — bukti nilai yang bikin klien betah perpanjang kontrak.",
    "Tambahkan step opsional 'Creative Studio' (hook, copy, storyboard, brief visual) sebagai upsell, terutama untuk klien yang pilih 'Belum ada' materi kreatif di Step 2 — margin tinggi dan mempercepat launch.",
    "Buat paket berjenjang sebagai alur onboarding: Audit gratis → Pilot 1 bulan → Scale Retainer, dengan reminder/otomasi perpanjangan menjelang akhir periode kampanye agar churn rendah dan pendapatan berulang."
  ]
};
