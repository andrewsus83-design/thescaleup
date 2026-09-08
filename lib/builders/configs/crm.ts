import type { BuilderConfig } from "@/lib/builders/wizard-types";

export const crm: BuilderConfig = {
  slug: "crm",
  title: "CRM Builder",
  persona:
    "CBO + CTO ScaleUp — arsitek pertumbuhan revenue & sistem CRM untuk UMKM/brand Indonesia",
  steps: [
    {
      title: "Rancang Flow & Pipeline Penjualan",
      subtitle:
        "Tentukan dulu perjalanan pelanggan Anda — dari kenal sampai jadi repeat buyer. Ini 'rel' tempat semua kontak akan bergerak, biar tidak ada lead yang nyangkut tanpa ditindaklanjuti.",
      fields: [
        {
          type: "cards",
          label: "Cara menyusun flow",
          key: "flow_mode",
          hint: "Anda tidak harus tahu tahapan yang benar dari awal — biar sistem yang rekomendasikan, atau susun sendiri.",
          options: [
            {
              value: "auto",
              label: "Rekomendasi Sistem",
              desc: "ScaleUp menyusun pipeline optimal otomatis dari hasil audit & jenis bisnis Anda. Anda tinggal setujui / sesuaikan sedikit.",
            },
            {
              value: "custom",
              label: "Susun Sendiri (Custom)",
              desc: "Bangun tahapan pipeline Anda sendiri — seperti kolom board di Task Management. ScaleUp bantu rapikan agar tetap terukur.",
            },
          ],
        },
        {
          type: "cards",
          label: "Titik awal template pipeline",
          key: "pipeline_template",
          hint: "Kalau pilih 'Rekomendasi Sistem', ini titik awal yang bisa kami sesuaikan. Kalau 'Susun Sendiri', pilih Custom lalu isi tahapan di bawah.",
          options: [
            {
              value: "standard",
              label: "Standar UMKM/Brand",
              desc: "Lead → Prospek → Follow-up → Closing → Repeat. Siap pakai, cocok untuk mayoritas bisnis.",
            },
            {
              value: "high_ticket",
              label: "High-Ticket / Jasa",
              desc: "Ada tahap Konsultasi & Negosiasi. Untuk produk/jasa dengan proses keputusan panjang.",
            },
            {
              value: "ecommerce",
              label: "E-commerce / Repeat",
              desc: "Lead → Order → Repeat → Loyal. Untuk toko dengan pembelian berulang & retensi.",
            },
            {
              value: "custom",
              label: "Custom",
              desc: "Susun tahapan sendiri. Isi kolom 'Tahapan custom' di bawah.",
            },
          ],
        },
        {
          type: "stages",
          label: "Tahapan pipeline — edit nama & urutan",
          key: "pipeline_stages",
          hint: "Ganti nama tiap tahap, ubah urutan (Step 1..n), tambah/hapus sesuai proses jualan Anda. Untuk mode Rekomendasi Sistem, default ini disusun ScaleUp dari audit; untuk Custom, susun sepenuhnya sendiri.",
          options: [
            { value: "lead_baru", label: "Lead Baru" },
            { value: "prospek", label: "Prospek / Qualified" },
            { value: "followup", label: "Follow-up" },
            { value: "negosiasi", label: "Negosiasi" },
            { value: "closing", label: "Closing / Deal" },
            { value: "repeat", label: "Repeat / Retensi" },
          ],
        },
        {
          type: "textarea",
          label: "Kriteria lead 'layak dikejar' (qualified)",
          key: "qualification_criteria",
          placeholder:
            "Contoh: sudah tanya harga & stok, lokasi bisa dikirim, membalas dalam 24 jam...",
          hint: "Apa tanda lead serius? Contoh: sudah tanya harga, tahu produk, budget cukup, domisili terjangkau.",
        },
        {
          type: "toggle",
          label: "Lacak nilai transaksi (deal value)",
          key: "track_deal_value",
          hint: "Aktifkan untuk hitung potensi & realisasi omzet per tahap dan proyeksi revenue.",
        },
        {
          type: "radio",
          label: "Penugasan lead ke tim",
          key: "lead_assignment",
          hint: "Bagaimana lead masuk dibagi ke tim sales/CS?",
          options: [
            { value: "round_robin", label: "Otomatis bergilir (round-robin)", desc: "Adil & merata antar tim" },
            { value: "by_source", label: "Berdasarkan sumber/channel", desc: "Mis. WA ke tim A, IG ke tim B" },
            { value: "manual", label: "Manual oleh admin", desc: "Admin assign sendiri" },
            { value: "single", label: "Satu orang / owner", desc: "Bisnis masih dipegang sendiri" },
          ],
        },
      ],
    },
    {
      title: "Kontak & Sumber Leads",
      subtitle:
        "Setelah flow siap, kumpulkan semua pelanggan & calon pelanggan ke dalam pipeline. Makin rapi datanya, makin gampang di-follow-up dan diukur.",
      fields: [
        {
          type: "cards",
          label: "Cara masukkan data kontak",
          key: "import_method",
          hint: "Pilih cara termudah sesuai kondisi data Anda sekarang.",
          options: [
            {
              value: "spreadsheet",
              label: "Import dari Spreadsheet",
              desc: "Punya data di Excel/Google Sheets (nama, no WA, dll). Paling cepat untuk migrasi massal.",
            },
            {
              value: "manual",
              label: "Input Manual Bertahap",
              desc: "Belum banyak data. Tim input satu-satu sambil jalan. Cocok untuk yang baru mulai.",
            },
            {
              value: "integration",
              label: "Tarik dari Channel",
              desc: "Sinkron otomatis dari WA Business, Instagram, & marketplace. ScaleUp bantu setup koneksinya.",
            },
          ],
        },
        {
          type: "url",
          label: "Link Google Sheets data kontak",
          key: "contact_sheet_url",
          placeholder: "https://docs.google.com/spreadsheets/...",
          hint: "Set akses 'Anyone with link' agar tim ScaleUp bisa proses. Kosongkan jika pilih input manual.",
        },
        {
          type: "sourcelinks",
          label: "Sumber datang-nya leads + link integrasi",
          key: "lead_sources",
          hint: "Pilih channel tempat calon pelanggan menghubungi Anda, lalu (opsional) tempel link akun/halaman/integrasi tiap channel agar tim ScaleUp bisa sambungkan otomatis. Dipakai juga untuk ukur channel mana paling untung.",
          options: [
            { value: "whatsapp", label: "WhatsApp" },
            { value: "instagram", label: "Instagram (DM/Comment)" },
            { value: "tiktok", label: "TikTok" },
            { value: "facebook", label: "Facebook / Meta Ads" },
            { value: "marketplace", label: "Marketplace (Shopee/Tokopedia)" },
            { value: "website", label: "Website / Landing Page" },
            { value: "google_ads", label: "Google / Google Ads" },
            { value: "referral", label: "Referral / Mulut ke mulut" },
            { value: "offline", label: "Offline / Walk-in / Event" },
          ],
        },
        {
          type: "multiselect",
          label: "Data yang mau disimpan per kontak",
          key: "contact_fields",
          hint: "Minimal Nama + No WhatsApp. Sisanya sesuaikan kebutuhan follow-up & segmentasi.",
          options: [
            { value: "nama", label: "Nama" },
            { value: "no_wa", label: "No. HP / WhatsApp" },
            { value: "email", label: "Email" },
            { value: "kota", label: "Kota / Domisili" },
            { value: "produk_minat", label: "Produk / layanan yang diminati" },
            { value: "sumber", label: "Sumber lead" },
            { value: "tag", label: "Tag / Label (hot, warm, cold)" },
            { value: "catatan", label: "Catatan interaksi" },
          ],
        },
        {
          type: "taglist",
          label: "Kategori pelanggan (opsional)",
          key: "customer_categories",
          hint: "Segmen pelanggan yang bisa ditempel ke tiap kontak — mis. VIP, Reseller, Korporat. Klien memilih kategori (opsional) saat menambah/mengelola kontak di board. Kosongkan untuk pakai default ScaleUp.",
          options: [
            { value: "baru", label: "Pelanggan Baru" },
            { value: "setia", label: "Pelanggan Setia" },
            { value: "vip", label: "VIP" },
            { value: "reseller", label: "Reseller / Grosir" },
            { value: "korporat", label: "Korporat / B2B" },
            { value: "tidak_aktif", label: "Tidak Aktif" },
          ],
        },
        {
          type: "select",
          label: "Perkiraan jumlah kontak saat ini",
          key: "contact_volume",
          hint: "Untuk menentukan struktur database & paket otomatisasi yang pas.",
          options: [
            { value: "lt_500", label: "< 500 kontak" },
            { value: "500_5000", label: "500 - 5.000 kontak" },
            { value: "5000_50000", label: "5.000 - 50.000 kontak" },
            { value: "gt_50000", label: "> 50.000 kontak" },
          ],
        },
      ],
    },
    {
      title: "Otomatisasi Follow-up & Retensi",
      subtitle:
        "Set sekali, jalan otomatis. Reminder & pesan follow-up terkirim tepat waktu lewat WhatsApp/email — tidak ada lagi lead lupa di-chat.",
      fields: [
        {
          type: "multiselect",
          label: "Channel follow-up",
          key: "followup_channels",
          hint: "WhatsApp paling efektif untuk pasar Indonesia. Email untuk broadcast & data pelanggan berkelanjutan.",
          options: [
            { value: "whatsapp", label: "WhatsApp (chat/broadcast)" },
            { value: "email", label: "Email" },
            { value: "sms", label: "SMS" },
          ],
        },
        {
          type: "text",
          label: "Nomor WhatsApp pengirim",
          key: "wa_sender_number",
          placeholder: "+62...",
          hint: "Nomor bisnis untuk kirim follow-up. Idealnya WhatsApp Business API agar bisa broadcast tanpa diblokir.",
        },
        {
          type: "multiselect",
          label: "Momen follow-up otomatis",
          key: "followup_triggers",
          hint: "Kapan sistem otomatis mengingatkan/mengirim pesan. Pilih yang relevan dengan siklus jualan Anda.",
          options: [
            { value: "welcome", label: "Sambutan lead baru (H+0)", desc: "Respon instan begitu lead masuk" },
            { value: "followup_1", label: "Follow-up belum closing (H+1)", desc: "Ingatkan lead yang belum jawab" },
            { value: "followup_2", label: "Follow-up ke-2 (H+3)", desc: "Dorongan kedua + penawaran" },
            { value: "abandoned", label: "Prospek diam > 7 hari", desc: "Reaktivasi lead dingin" },
            { value: "after_purchase", label: "Terima kasih pasca-beli", desc: "Bangun loyalitas + minta review" },
            { value: "repeat_reminder", label: "Ingatkan repeat order", desc: "Sesuai siklus habis produk" },
            { value: "birthday", label: "Ucapan ulang tahun / hari spesial", desc: "Kirim promo personal" },
          ],
        },
        {
          type: "textarea",
          label: "Draft isi pesan (opsional)",
          key: "message_templates",
          placeholder: "Contoh sapaan: 'Halo Kak {nama}, terima kasih sudah tertarik dengan {produk}...'",
          hint: "Tulis nada/isi pesan yang Anda mau. Kosongkan dan tim copywriter ScaleUp yang buatkan sesuai brand voice.",
        },
        {
          type: "cards",
          label: "Program retensi pelanggan",
          key: "retention_program",
          hint: "Strategi agar pelanggan beli lagi & lagi — sumber profit paling murah.",
          options: [
            { value: "loyalty", label: "Loyalty / Poin", desc: "Reward pembelian berulang, dorong repeat rate" },
            { value: "reminder_cycle", label: "Reminder Siklus Beli", desc: "Ingatkan saat produk diperkirakan habis" },
            { value: "vip_broadcast", label: "VIP & Broadcast Promo", desc: "Segmentasi pelanggan loyal untuk penawaran eksklusif" },
            { value: "none_yet", label: "Belum, fokus akuisisi dulu", desc: "Aktifkan retensi di fase berikutnya" },
          ],
        },
      ],
    },
    {
      title: "Dashboard & Report (Dikerjakan ScaleUp)",
      subtitle:
        "Tim ScaleUp merakit CRM Anda, menyambungkan channel & otomatisasi, lalu menyiapkan dashboard performa. Anda tinggal pantau angkanya.",
      auto: true,
      fields: [
        {
          type: "info",
          label: "Yang kami rakit & serahkan",
          hint: "Berdasarkan flow & pilihan Anda: database kontak + import data, pipeline drag-and-drop, koneksi WhatsApp/email, dan alur follow-up otomatis — siap dipakai tim Anda.",
        },
        {
          type: "info",
          label: "Dashboard konversi & funnel",
          hint: "Lihat berapa lead masuk, berapa jadi prospek, dan berapa closing di tiap tahap. Ketahuan persis di tahap mana leads paling banyak bocor.",
        },
        {
          type: "info",
          label: "LTV & Repeat Rate",
          hint: "Otomatis hitung nilai seumur-hidup pelanggan (LTV), rata-rata order, dan persentase pelanggan yang beli ulang — kunci pertumbuhan jangka panjang.",
        },
        {
          type: "info",
          label: "ROI per channel & response time",
          hint: "Bandingkan channel mana (WA/IG/Ads/Marketplace) yang menghasilkan closing terbanyak per rupiah, plus kecepatan respon tim Anda ke lead.",
        },
        {
          type: "info",
          label: "Laporan berkala & optimasi",
          hint: "Report bulanan + sesi review bersama ScaleUp untuk memperbaiki template, timing follow-up, dan pipeline agar konversi terus naik.",
        },
      ],
    },
  ],
  suggestions: [
    "Jual sebagai layanan RECURRING: paket bulanan 'CRM + Follow-up Managed' — ScaleUp yang urus optimasi template, timing, dan report tiap bulan, bukan sekali setup lalu ditinggal. Ini yang bikin retensi klien tinggi.",
    "Untuk mode Rekomendasi Sistem: pakai data audit (kategori, harga, siklus beli) untuk auto-pilih template pipeline + tahapan default, lalu klien tinggal approve — kurangi friksi onboarding.",
    "Tawarkan add-on WhatsApp Business API resmi (broadcast tanpa risiko blokir) sebagai upsell margin tinggi; banyak UMKM butuh tapi bingung setup sendiri.",
    "Sambungkan output ke Task Management & Customer Support Builder: lead baru otomatis jadi tugas follow-up, dan pertanyaan berulang masuk ke knowledge base — kunci upsell antar-builder.",
    "Sediakan 'Health Check' triwulanan: audit repeat rate & LTV klien, lalu rekomendasikan campaign retensi baru — jadi alasan natural untuk perpanjang kontrak dan upsell.",
  ],
};
