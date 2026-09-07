import type { BuilderConfig } from "@/lib/builders/wizard-types";

export const store: BuilderConfig = {
  "slug": "store",
  "title": "Online Store & Integrasi",
  "persona": "CTO + CBO ScaleUp — arsitek produk sekaligus pemikir bisnis. Prinsip saya: builder harus sesederhana mengisi form WhatsApp, tapi menghasilkan toko yang siap jualan lewat sosmed dan link sendiri dengan fee sekecil mungkin. Setiap langkah punya default cerdas, wording ramah UMKM, dan langkah teknis berat (sinkronisasi, katalog feed, optimasi) dikerjakan otomatis oleh tim ScaleUp — bukan beban klien.",
  "steps": [
    {
      "title": "Setup Toko Dasar",
      "subtitle": "Identitas toko Anda. Cukup isi sekali, langsung dipakai di semua kanal jualan.",
      "fields": [
        {
          "type": "text",
          "label": "Nama Toko / Brand",
          "key": "store_name",
          "placeholder": "cth: Kopi Nusantara",
          "hint": "Nama yang muncul di link toko dan pesan WhatsApp."
        },
        {
          "type": "text",
          "label": "Tagline Singkat (opsional)",
          "key": "store_tagline",
          "placeholder": "cth: Kopi lokal, roasting harian"
        },
        {
          "type": "select",
          "label": "Kategori Usaha",
          "key": "business_category",
          "hint": "Menentukan template etalase & rekomendasi ongkir.",
          "options": [
            {
              "value": "fashion",
              "label": "Fashion & Aksesoris"
            },
            {
              "value": "fnb",
              "label": "Makanan & Minuman"
            },
            {
              "value": "beauty",
              "label": "Kecantikan & Perawatan"
            },
            {
              "value": "home",
              "label": "Rumah Tangga & Dekorasi"
            },
            {
              "value": "health",
              "label": "Kesehatan & Suplemen"
            },
            {
              "value": "electronics",
              "label": "Elektronik & Gadget"
            },
            {
              "value": "service",
              "label": "Jasa / Digital"
            },
            {
              "value": "other",
              "label": "Lainnya"
            }
          ]
        },
        {
          "type": "image",
          "label": "Logo Toko",
          "key": "store_logo",
          "hint": "Format PNG/JPG, min 500x500px. Belum punya? Tim kami bisa bantu buatkan."
        },
        {
          "type": "color",
          "label": "Warna Brand Utama",
          "key": "brand_color",
          "hint": "Dipakai untuk tombol & aksen halaman toko."
        },
        {
          "type": "info",
          "label": "Mata Uang",
          "key": "currency_info",
          "hint": "Toko ini menggunakan Rupiah (IDR). Semua harga otomatis diformat Rp dengan pemisah ribuan."
        },
        {
          "type": "text",
          "label": "Nomor WhatsApp Bisnis",
          "key": "store_whatsapp",
          "placeholder": "cth: 0812xxxxxxx",
          "hint": "Tujuan semua order & checkout WhatsApp. Gunakan nomor yang aktif."
        },
        {
          "type": "text",
          "label": "Kota/Wilayah Asal Pengiriman",
          "key": "origin_city",
          "placeholder": "cth: Bandung, Jawa Barat",
          "hint": "Dasar hitung ongkir ke pembeli."
        },
        {
          "type": "multiselect",
          "label": "Cara Pengiriman",
          "key": "fulfillment_methods",
          "hint": "Pilih semua yang Anda sediakan.",
          "options": [
            {
              "value": "instant",
              "label": "Kurir Instan",
              "desc": "GoSend / GrabExpress, sameday dalam kota."
            },
            {
              "value": "regular",
              "label": "Kurir Reguler",
              "desc": "JNE / J&T / SiCepat, antar kota."
            },
            {
              "value": "pickup",
              "label": "Ambil di Tempat (Pickup)",
              "desc": "Pembeli ambil sendiri di lokasi Anda."
            },
            {
              "value": "self_delivery",
              "label": "Antar Sendiri",
              "desc": "Anda kirim manual (radius terbatas)."
            }
          ]
        },
        {
          "type": "cards",
          "label": "Model Tarif Ongkir",
          "key": "shipping_pricing",
          "hint": "Bisa diubah kapan saja.",
          "options": [
            {
              "value": "flat",
              "label": "Ongkir Flat",
              "desc": "Satu tarif untuk semua tujuan. Paling simpel."
            },
            {
              "value": "by_zone",
              "label": "Per Wilayah",
              "desc": "Tarif beda untuk dalam kota / luar kota."
            },
            {
              "value": "realtime",
              "label": "Otomatis (Real-time)",
              "desc": "Ongkir dihitung live via API kurir. Diaktifkan tim ScaleUp."
            },
            {
              "value": "free_min",
              "label": "Gratis Ongkir Bersyarat",
              "desc": "Gratis ongkir di atas nominal belanja tertentu."
            }
          ]
        }
      ]
    },
    {
      "title": "Katalog Produk",
      "subtitle": "Masukkan produk pertama Anda. Sisanya bisa ditambah nanti lewat dashboard atau kami bantu import massal.",
      "fields": [
        {
          "type": "cards",
          "label": "Cara Isi Katalog",
          "key": "catalog_input_method",
          "options": [
            {
              "value": "manual_one",
              "label": "Input Manual Satu-satu",
              "desc": "Cocok untuk katalog kecil (<20 produk)."
            },
            {
              "value": "import_csv",
              "label": "Import File / Spreadsheet",
              "desc": "Punya banyak produk? Kirim daftarnya, tim ScaleUp yang input."
            },
            {
              "value": "from_ig",
              "label": "Ambil dari Instagram/Katalog Lama",
              "desc": "Kami tarik dari feed/katalog Anda yang sudah ada."
            }
          ]
        },
        {
          "type": "text",
          "label": "Nama Produk Pertama",
          "key": "product_name",
          "placeholder": "cth: Kaos Polos Premium Hitam"
        },
        {
          "type": "text",
          "label": "Harga (Rp)",
          "key": "product_price",
          "placeholder": "cth: 89000",
          "hint": "Angka saja, tanpa titik/koma."
        },
        {
          "type": "text",
          "label": "Stok",
          "key": "product_stock",
          "placeholder": "cth: 50",
          "hint": "Kosongkan bila stok selalu ready / pre-order."
        },
        {
          "type": "image",
          "label": "Foto Produk",
          "key": "product_photos",
          "hint": "1–5 foto. Foto pertama jadi thumbnail. Rasio 1:1 paling rapi di sosmed."
        },
        {
          "type": "textarea",
          "label": "Deskripsi Singkat",
          "key": "product_description",
          "placeholder": "Bahan, ukuran, keunggulan, cara pakai...",
          "hint": "Bantu pembeli yakin sebelum chat."
        },
        {
          "type": "toggle",
          "label": "Produk Punya Varian?",
          "key": "has_variants",
          "hint": "Aktifkan bila ada ukuran/warna/rasa berbeda."
        },
        {
          "type": "text",
          "label": "Daftar Varian (jika ada)",
          "key": "variant_options",
          "placeholder": "cth: Ukuran: S, M, L, XL | Warna: Hitam, Putih",
          "hint": "Pisahkan dengan koma. Tim kami rapikan jadi pilihan di halaman produk."
        },
        {
          "type": "select",
          "label": "Perkiraan Total Produk",
          "key": "catalog_size",
          "hint": "Agar kami siapkan struktur kategori yang pas.",
          "options": [
            {
              "value": "1_10",
              "label": "1–10 produk"
            },
            {
              "value": "11_50",
              "label": "11–50 produk"
            },
            {
              "value": "51_200",
              "label": "51–200 produk"
            },
            {
              "value": "200_plus",
              "label": "Lebih dari 200 produk"
            }
          ]
        }
      ]
    },
    {
      "title": "Kanal Jualan & Integrasi",
      "subtitle": "Sambungkan toko ke tempat pembeli Anda berada. Fokus: fee serendah mungkin dengan checkout WhatsApp & link toko sendiri.",
      "fields": [
        {
          "type": "multiselect",
          "label": "Kanal Penjualan Aktif",
          "key": "sales_channels",
          "hint": "Pilih semua yang mau diaktifkan. Semua tersinkron dari satu katalog.",
          "options": [
            {
              "value": "whatsapp",
              "label": "Checkout via WhatsApp",
              "desc": "Pembeli klik 'Beli' → order lengkap masuk ke WA Anda. Nol fee transaksi."
            },
            {
              "value": "own_store",
              "label": "Link Toko Sendiri",
              "desc": "Halaman toko milik Anda (di luar marketplace) — bebas komisi marketplace."
            },
            {
              "value": "ig_shop",
              "label": "Katalog Instagram",
              "desc": "Produk tampil & bisa di-tag di postingan/story IG."
            },
            {
              "value": "tiktok_shop",
              "label": "TikTok Shop",
              "desc": "Sinkron katalog untuk jualan di TikTok."
            },
            {
              "value": "marketplace_sync",
              "label": "Sinkron Marketplace",
              "desc": "Tarik/tampilkan stok dari Shopee/Tokopedia (opsional, ada fee marketplace)."
            }
          ]
        },
        {
          "type": "text",
          "label": "Link Toko Sendiri",
          "key": "own_store_slug",
          "placeholder": "cth: kopinusantara",
          "hint": "Toko Anda jadi: scaleup.store/kopinusantara. Bisa upgrade ke domain sendiri nanti."
        },
        {
          "type": "radio",
          "label": "Gaya Checkout",
          "key": "checkout_style",
          "options": [
            {
              "value": "quick_wa",
              "label": "Quick Order WhatsApp",
              "desc": "Paling cepat: 1 klik langsung chat berisi detail order. Cocok volume kecil-menengah."
            },
            {
              "value": "cart_wa",
              "label": "Keranjang + Kirim ke WhatsApp",
              "desc": "Pembeli isi keranjang, ringkasan order dikirim ke WA. Rapi untuk multi-item."
            },
            {
              "value": "full_checkout",
              "label": "Checkout Penuh + Bayar Online",
              "desc": "Pembeli bayar langsung via payment gateway. Cocok volume tinggi."
            }
          ]
        },
        {
          "type": "multiselect",
          "label": "Metode Pembayaran",
          "key": "payment_methods",
          "hint": "QRIS & transfer bank punya fee paling rendah untuk UMKM.",
          "options": [
            {
              "value": "qris",
              "label": "QRIS",
              "desc": "Terima semua e-wallet/bank via 1 QR. MDR rendah (0,3–0,7%)."
            },
            {
              "value": "bank_transfer",
              "label": "Transfer Bank Manual",
              "desc": "Nol fee gateway. Konfirmasi manual/auto-cek."
            },
            {
              "value": "va",
              "label": "Virtual Account",
              "desc": "Konfirmasi otomatis. Fee flat per transaksi."
            },
            {
              "value": "ewallet",
              "label": "E-Wallet (GoPay/OVO/Dana)",
              "desc": "Praktis untuk pembeli mobile."
            },
            {
              "value": "cod",
              "label": "COD (Bayar di Tempat)",
              "desc": "Untuk pengiriman lokal/kurir instan."
            }
          ]
        },
        {
          "type": "cards",
          "label": "Payment Gateway",
          "key": "payment_gateway",
          "hint": "Kami rekomendasikan yang fee-nya paling ramah UMKM.",
          "options": [
            {
              "value": "qris_direct",
              "label": "QRIS Langsung (Rekomendasi)",
              "desc": "Fee terendah, dana masuk ke rekening Anda. Ideal untuk margin tipis."
            },
            {
              "value": "gateway_lowfee",
              "label": "Gateway Fee Rendah",
              "desc": "Xendit/Midtrans/DOKU — VA & e-wallet lengkap, di-setup tim ScaleUp."
            },
            {
              "value": "manual_only",
              "label": "Transfer Manual Saja",
              "desc": "Tanpa gateway sama sekali. Nol fee, konfirmasi manual."
            },
            {
              "value": "decide_later",
              "label": "Bantu Pilihkan",
              "desc": "Tim ScaleUp analisis volume & margin Anda lalu rekomendasikan."
            }
          ]
        }
      ]
    },
    {
      "title": "Optimasi & Sinkronisasi Otomatis",
      "subtitle": "Langkah ini dikerjakan penuh oleh tim ScaleUp. Anda tidak perlu mengisi apa pun — cukup review hasilnya saat toko siap.",
      "auto": true,
      "fields": [
        {
          "type": "info",
          "label": "Sinkronisasi Katalog Multi-Kanal",
          "key": "auto_catalog_sync",
          "hint": "Satu katalog otomatis terhubung ke WhatsApp, link toko sendiri, IG, dan TikTok Shop. Ubah harga/stok sekali, update di semua kanal."
        },
        {
          "type": "info",
          "label": "Sinkronisasi Stok Real-time",
          "key": "auto_stock_sync",
          "hint": "Stok berkurang otomatis lintas kanal saat ada penjualan, mencegah overselling."
        },
        {
          "type": "info",
          "label": "SEO & Product Feed",
          "key": "auto_seo_feed",
          "hint": "Meta title, deskripsi, dan feed produk (Google/Meta/TikTok) di-generate & dioptimasi otomatis agar toko mudah ditemukan."
        },
        {
          "type": "info",
          "label": "Template Pesan & Auto-Reply WhatsApp",
          "key": "auto_wa_template",
          "hint": "Format order, balasan cepat, dan follow-up cart yang ditinggalkan disiapkan otomatis."
        },
        {
          "type": "info",
          "label": "Optimasi Kecepatan & Mobile",
          "key": "auto_speed_mobile",
          "hint": "Kompres gambar, lazy-load, dan tampilan mobile-first di-set agar toko ngebut dibuka dari sosmed."
        },
        {
          "type": "info",
          "label": "Pixel & Analytics Terpasang",
          "key": "auto_analytics",
          "hint": "Meta Pixel, TikTok Pixel, dan dashboard penjualan dipasang untuk ukur konversi & retargeting."
        },
        {
          "type": "info",
          "label": "Review & Serah Terima",
          "key": "auto_review_handoff",
          "hint": "Tim ScaleUp cek seluruh toko, kirim link preview untuk approval Anda, baru go-live."
        }
      ]
    }
  ],
  "suggestions": [
    "Jadikan checkout WhatsApp sebagai default & unggulan utama di marketing — inilah pembeda ScaleUp vs Shopify/Woo: nol fee transaksi dan langsung masuk chat. Tonjolkan 'hemat komisi marketplace' sebagai angka nyata (mis. hemat 5–8% per transaksi) di landing page builder.",
    "Bangun model RECURRING lewat langkah otomatis (Step 4): jual sebagai paket bulanan 'Toko Terkelola' — sinkronisasi katalog, optimasi feed/SEO, auto-reply WA, dan laporan penjualan bulanan. Klien bayar berlangganan, bukan sekali setup.",
    "Tambahkan fitur 'Abandoned Cart Follow-up' via WhatsApp otomatis dan broadcast promo tersegmentasi — ini fitur berulang bernilai tinggi yang sulit ditiru toko DIY dan menaikkan retensi langganan.",
    "Sediakan template etalase per kategori (F&B, fashion, beauty) + AI generator deskripsi produk & foto agar onboarding UMKM makin cepat; ini menurunkan drop-off di Step 2 (produk) yang biasanya paling berat.",
    "Buat tier upsell: mulai dari link scaleup.store/nama (gratis/murah) → domain sendiri + payment gateway low-fee → paket dikelola penuh. Naikkan nilai per klien seiring toko mereka bertumbuh, sekaligus mengunci mereka di ekosistem ScaleUp."
  ]
};
