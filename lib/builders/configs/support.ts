import type { BuilderConfig } from "@/lib/builders/wizard-types";

export const support: BuilderConfig = {
  slug: "support",
  title: "Customer Support Builder",
  persona:
    "CBO + CTO ScaleUp — arsitek layanan pelanggan & retensi untuk brand Indonesia. Support yang cepat = pelanggan balik lagi.",
  steps: [
    {
      title: "Channel & Setup Support",
      subtitle:
        "Satukan semua pintu masuk pertanyaan pelanggan ke satu tempat, biar tidak ada chat yang tercecer di banyak aplikasi.",
      fields: [
        {
          type: "multiselect",
          label: "Channel layanan pelanggan",
          key: "support_channels",
          hint: "Pilih semua tempat pelanggan biasa bertanya. WhatsApp hampir wajib untuk pasar Indonesia.",
          options: [
            { value: "whatsapp", label: "WhatsApp" },
            { value: "instagram", label: "Instagram DM" },
            { value: "email", label: "Email" },
            { value: "livechat", label: "Live Chat di Website" },
            { value: "marketplace", label: "Chat Marketplace (Shopee/Tokopedia)" },
            { value: "telegram", label: "Telegram" },
            { value: "phone", label: "Telepon / Call Center" },
          ],
        },
        {
          type: "radio",
          label: "Channel utama (prioritas)",
          key: "primary_channel",
          hint: "Channel paling ramai — di sinilah kami fokuskan otomatisasi & SLA respon.",
          options: [
            { value: "whatsapp", label: "WhatsApp", desc: "Paling umum & cepat dibaca" },
            { value: "instagram", label: "Instagram DM", desc: "Untuk brand yang kuat di IG" },
            { value: "livechat", label: "Live Chat Web", desc: "Untuk traffic website tinggi" },
            { value: "marketplace", label: "Marketplace", desc: "Untuk seller Shopee/Tokopedia" },
          ],
        },
        {
          type: "text",
          label: "Nomor WhatsApp / kontak support",
          key: "support_contact",
          placeholder: "+62...",
          hint: "Nomor/akun yang dipakai melayani pelanggan. Idealnya WhatsApp Business API agar bisa multi-agent & auto-reply.",
        },
        {
          type: "select",
          label: "Jam operasional support",
          key: "operating_hours",
          hint: "Menentukan setup auto-reply di luar jam kerja.",
          options: [
            { value: "24_7", label: "24/7 (dengan bantuan bot)" },
            { value: "business", label: "Jam kerja (mis. 09.00–18.00)" },
            { value: "extended", label: "Extended (mis. 08.00–22.00)" },
            { value: "custom", label: "Custom / musiman" },
          ],
        },
        {
          type: "select",
          label: "Ukuran tim support saat ini",
          key: "support_team_size",
          hint: "Untuk menentukan struktur routing & jumlah agent di tool.",
          options: [
            { value: "solo", label: "Sendiri / owner" },
            { value: "small", label: "2–3 orang" },
            { value: "team", label: "4–10 orang" },
            { value: "large", label: "> 10 orang" },
          ],
        },
      ],
    },
    {
      title: "Knowledge Base & Respon Cepat",
      subtitle:
        "Kumpulkan pertanyaan yang paling sering muncul + jawabannya. Ini bahan bakar untuk auto-reply, chatbot, dan template balasan tim.",
      fields: [
        {
          type: "textarea",
          label: "Pertanyaan paling sering (FAQ)",
          key: "top_faqs",
          placeholder:
            "Satu per baris:\nBerapa ongkir ke luar kota?\nBisa COD?\nGaransi berapa lama?\nCara lacak pesanan?",
          hint: "Tulis 5–15 pertanyaan yang paling sering ditanya. Tim ScaleUp susun jadi knowledge base + jawaban standar.",
        },
        {
          type: "textarea",
          label: "Kebijakan penting (retur, garansi, pengiriman)",
          key: "policies",
          placeholder:
            "Contoh: Retur maksimal 3 hari setelah barang diterima; garansi 30 hari; pengiriman H+1 untuk order sebelum jam 14.00...",
          hint: "Aturan resmi yang harus konsisten dijawab. Jadi acuan bot & tim agar tidak salah info.",
        },
        {
          type: "cards",
          label: "Nada / tone balasan",
          key: "support_tone",
          hint: "Gaya bahasa saat melayani pelanggan — biar konsisten dengan brand.",
          options: [
            { value: "friendly", label: "Ramah & santai", desc: "Sapaan hangat, pakai 'Kak'. Cocok untuk brand konsumer." },
            { value: "professional", label: "Profesional", desc: "Sopan, lugas, to the point. Cocok untuk B2B/jasa." },
            { value: "playful", label: "Playful / muda", desc: "Ekspresif, emoji, bahasa gaul. Cocok untuk brand Gen-Z." },
          ],
        },
        {
          type: "url",
          label: "Link dokumen produk/kebijakan (opsional)",
          key: "docs_url",
          placeholder: "https://... (Google Doc / Notion / katalog)",
          hint: "Kalau sudah ada dokumen, share link-nya (akses 'Anyone with link') agar kami pakai untuk melatih knowledge base.",
        },
      ],
    },
    {
      title: "Otomatisasi, Ticketing & SLA",
      subtitle:
        "Otomatiskan yang berulang, escalate yang penting. Pelanggan dapat respon cepat, tim Anda tidak kewalahan.",
      fields: [
        {
          type: "toggle",
          label: "Aktifkan auto-reply (sapaan & di luar jam kerja)",
          key: "enable_autoreply",
          hint: "Balasan instan begitu pelanggan chat — walau tim belum sempat balas. Menurunkan lead yang kabur karena lama.",
        },
        {
          type: "cards",
          label: "Cakupan chatbot / asisten otomatis",
          key: "chatbot_scope",
          hint: "Seberapa jauh bot menjawab sebelum diserahkan ke manusia.",
          options: [
            { value: "faq_bot", label: "Bot FAQ", desc: "Jawab pertanyaan umum (ongkir, jam buka, cara order) otomatis." },
            { value: "order_status", label: "FAQ + Status Order", desc: "Plus cek resi/status pesanan otomatis." },
            { value: "full_handover", label: "Bot + Handover Cerdas", desc: "Bot jawab dulu, lalu oper ke agent yang tepat saat perlu." },
            { value: "human_only", label: "Tanpa bot dulu", desc: "Fokus template & routing manusia. Bot menyusul di fase berikut." },
          ],
        },
        {
          type: "toggle",
          label: "Aktifkan ticketing (lacak setiap kasus sampai selesai)",
          key: "enable_ticketing",
          hint: "Setiap pertanyaan jadi 'tiket' berstatus (baru → diproses → selesai) agar tidak ada yang terlupa.",
        },
        {
          type: "select",
          label: "Target waktu respon (SLA)",
          key: "sla_target",
          hint: "Janji kecepatan balas pertama. Dipakai untuk alert kalau ada chat menunggu terlalu lama.",
          options: [
            { value: "5m", label: "≤ 5 menit (jam kerja)" },
            { value: "30m", label: "≤ 30 menit" },
            { value: "1h", label: "≤ 1 jam" },
            { value: "same_day", label: "Hari yang sama" },
          ],
        },
        {
          type: "textarea",
          label: "Aturan eskalasi (opsional)",
          key: "escalation_rules",
          placeholder:
            "Contoh: komplain produk rusak → langsung ke owner; pertanyaan reseller → tim sales; keluhan > 2 jam belum solved → eskalasi ke supervisor.",
          hint: "Kapan sebuah kasus harus dinaikkan ke orang tertentu. Kosongkan dan kami buatkan aturan standar.",
        },
        {
          type: "toggle",
          label: "Kirim survei kepuasan (CSAT) setelah kasus selesai",
          key: "enable_csat",
          hint: "Ukur kepuasan pelanggan otomatis. Jadi bahan perbaikan layanan & bukti kualitas ke calon pelanggan.",
        },
      ],
    },
    {
      title: "Dashboard & Report (Dikerjakan ScaleUp)",
      subtitle:
        "Tim ScaleUp merakit sistem support Anda, melatih knowledge base & bot, lalu menyiapkan dashboard performa. Anda tinggal pantau kualitas layanan.",
      auto: true,
      fields: [
        {
          type: "info",
          label: "Yang kami rakit & serahkan",
          hint: "Berdasarkan pilihan Anda: inbox tergabung multi-channel, knowledge base + FAQ, auto-reply/chatbot, sistem ticketing + SLA, dan aturan eskalasi — siap dipakai tim Anda.",
        },
        {
          type: "info",
          label: "Dashboard response time & resolusi",
          hint: "Pantau kecepatan balas pertama, waktu penyelesaian, dan berapa kasus dibuka vs selesai — ketahuan kalau layanan mulai lambat.",
        },
        {
          type: "info",
          label: "Deflection rate (dijawab bot)",
          hint: "Persentase pertanyaan yang tuntas dijawab otomatis tanpa perlu tim — makin tinggi, makin hemat biaya support.",
        },
        {
          type: "info",
          label: "CSAT & dampak retensi",
          hint: "Skor kepuasan pelanggan + kaitannya dengan repeat order. Support yang baik adalah mesin retensi paling murah.",
        },
        {
          type: "info",
          label: "Laporan berkala & optimasi",
          hint: "Report bulanan + update knowledge base dari pertanyaan baru, sehingga bot makin pintar dan tim makin ringan tiap periode.",
        },
      ],
    },
  ],
  suggestions: [
    "Jual sebagai layanan RECURRING 'Support Managed': ScaleUp yang rawat knowledge base, latih ulang bot, dan kirim report CSAT bulanan — support butuh perawatan terus, jadi alasan kuat langganan berjalan.",
    "Pasangkan dengan CRM Builder: percakapan support otomatis jadi data kontak & tag di pipeline (mis. keluhan → segmen 'butuh perhatian'), sehingga support bukan cost center tapi sumber insight retensi.",
    "Tawarkan add-on WhatsApp Business API resmi + multi-agent sebagai upsell margin tinggi — solusi umum untuk brand yang chat-nya sudah tidak muat 1 nomor.",
    "Bangun library knowledge base & bot per-industri (F&B, fashion, klinik, jasa) agar onboarding klien baru cepat dan jadi bukti keahlian vertikal ScaleUp.",
    "Jadikan CSAT & deflection rate sebagai 'meter of success' di report klien — angka yang naik tiap bulan adalah pembenaran paling jelas untuk perpanjang kontrak.",
  ],
};
