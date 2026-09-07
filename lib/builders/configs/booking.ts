import type { BuilderConfig } from "@/lib/builders/wizard-types";

export const booking: BuilderConfig = {
  slug: "booking",
  title: "Booking System Builder",
  persona:
    "CTO + CBO ScaleUp — arsitek sistem reservasi online untuk klinik, salon, jasa, studio, dan bisnis berbasis janji temu di Indonesia.",
  steps: [
    {
      title: "Layanan & Jadwal",
      subtitle:
        "Tentukan apa yang bisa dibooking dan kapan. Ini fondasi kalender reservasi Anda.",
      fields: [
        {
          type: "stages",
          label: "Layanan yang bisa dibooking — edit nama & urutan",
          key: "booking_services",
          hint: "Daftar layanan/sesi yang bisa dipesan pelanggan. Tambah, ganti nama, atau urutkan sesuai penawaran Anda.",
          options: [
            { value: "konsultasi", label: "Konsultasi" },
            { value: "treatment_a", label: "Treatment A" },
            { value: "treatment_b", label: "Treatment B" },
          ],
        },
        {
          type: "select",
          label: "Durasi default per sesi",
          key: "session_duration",
          hint: "Berapa lama satu slot booking. Bisa disesuaikan per layanan nanti.",
          options: [
            { value: "15", label: "15 menit" },
            { value: "30", label: "30 menit" },
            { value: "45", label: "45 menit" },
            { value: "60", label: "60 menit" },
            { value: "90", label: "90 menit" },
            { value: "custom", label: "Berbeda per layanan" },
          ],
        },
        {
          type: "select",
          label: "Kapasitas per slot",
          key: "slot_capacity",
          hint: "Berapa pelanggan bisa dilayani pada waktu bersamaan (mis. jumlah kursi/ruang/terapis).",
          options: [
            { value: "1", label: "1 (satu per satu)" },
            { value: "2_3", label: "2 - 3" },
            { value: "4_plus", label: "4 atau lebih" },
            { value: "custom", label: "Custom per layanan" },
          ],
        },
        {
          type: "multiselect",
          label: "Hari operasional",
          key: "operating_days",
          hint: "Hari saat pelanggan boleh booking.",
          options: [
            { value: "sen", label: "Senin" },
            { value: "sel", label: "Selasa" },
            { value: "rab", label: "Rabu" },
            { value: "kam", label: "Kamis" },
            { value: "jum", label: "Jumat" },
            { value: "sab", label: "Sabtu" },
            { value: "min", label: "Minggu" },
          ],
        },
        {
          type: "text",
          label: "Jam operasional",
          key: "operating_hours",
          placeholder: "Contoh: 09.00 - 18.00",
          hint: "Rentang jam saat slot tersedia. Slot dibuat otomatis mengikuti durasi sesi.",
        },
        {
          type: "textarea",
          label: "Tanggal libur / pengecualian (opsional)",
          key: "holidays",
          placeholder: "Contoh: setiap tanggal merah, cuti 17 Agustus, libur akhir tahun...",
          hint: "Tanggal saat booking ditutup. Kosongkan jika tidak ada.",
        },
      ],
    },
    {
      title: "Staff & Ketersediaan",
      subtitle:
        "Atur siapa/berapa yang melayani dan bagaimana booking dibagi, agar jadwal tidak bentrok.",
      fields: [
        {
          type: "select",
          label: "Jumlah staff / resource",
          key: "staff_count",
          hint: "Berapa orang atau unit (ruang, meja, alat) yang melayani booking.",
          options: [
            { value: "1", label: "1 (sendiri)" },
            { value: "2_3", label: "2 - 3" },
            { value: "4_10", label: "4 - 10" },
            { value: "gt_10", label: "> 10" },
          ],
        },
        {
          type: "radio",
          label: "Cara membagi booking ke staff",
          key: "assignment_rule",
          hint: "Bagaimana booking masuk dialokasikan.",
          options: [
            { value: "round_robin", label: "Otomatis bergilir", desc: "Adil & merata antar staff." },
            { value: "by_service", label: "Berdasarkan layanan", desc: "Staff tertentu untuk layanan tertentu." },
            { value: "customer_choice", label: "Pelanggan memilih", desc: "Pelanggan pilih staff favorit saat booking." },
            { value: "owner", label: "Satu orang / owner", desc: "Semua ditangani sendiri." },
          ],
        },
        {
          type: "select",
          label: "Jeda antar booking (buffer)",
          key: "buffer_time",
          hint: "Waktu istirahat/persiapan antar sesi agar tidak terburu-buru.",
          options: [
            { value: "0", label: "Tanpa jeda" },
            { value: "10", label: "10 menit" },
            { value: "15", label: "15 menit" },
            { value: "30", label: "30 menit" },
          ],
        },
        {
          type: "text",
          label: "Maksimum booking per hari (opsional)",
          key: "max_per_day",
          placeholder: "Contoh: 20",
          hint: "Batasi jumlah booking harian agar tidak kewalahan. Kosongkan untuk tanpa batas.",
        },
        {
          type: "radio",
          label: "Model konfirmasi",
          key: "confirmation_mode",
          hint: "Apakah slot langsung terkunci, atau perlu Anda setujui dulu.",
          options: [
            { value: "instant", label: "Booking instan", desc: "Slot langsung terkonfirmasi otomatis. Paling praktis." },
            { value: "request", label: "Request lalu dikonfirmasi", desc: "Anda menyetujui manual sebelum slot terkunci." },
          ],
        },
      ],
    },
    {
      title: "Form, Notifikasi & Pembayaran",
      subtitle:
        "Data apa yang diminta, bagaimana pelanggan diingatkan, dan bagaimana pembayaran — kunci menekan no-show.",
      fields: [
        {
          type: "multiselect",
          label: "Data yang dikumpulkan saat booking",
          key: "booking_fields",
          hint: "Minimal Nama + No WhatsApp + Layanan + Tanggal/Jam.",
          options: [
            { value: "nama", label: "Nama" },
            { value: "no_wa", label: "No. WhatsApp" },
            { value: "email", label: "Email" },
            { value: "layanan", label: "Layanan yang dipilih" },
            { value: "jadwal", label: "Tanggal & jam" },
            { value: "jumlah_orang", label: "Jumlah orang" },
            { value: "staff", label: "Pilih staff" },
            { value: "catatan", label: "Catatan / keluhan" },
          ],
        },
        {
          type: "multiselect",
          label: "Channel konfirmasi & reminder",
          key: "notify_channels",
          hint: "WhatsApp paling efektif untuk pasar Indonesia.",
          options: [
            { value: "whatsapp", label: "WhatsApp" },
            { value: "email", label: "Email" },
            { value: "sms", label: "SMS" },
          ],
        },
        {
          type: "multiselect",
          label: "Momen notifikasi otomatis",
          key: "notify_moments",
          hint: "Kapan sistem mengirim pesan otomatis. Reminder H-1 sangat menurunkan no-show.",
          options: [
            { value: "confirm", label: "Konfirmasi instan", desc: "Begitu booking masuk" },
            { value: "reminder_1d", label: "Reminder H-1", desc: "Sehari sebelum jadwal" },
            { value: "reminder_2h", label: "Reminder 2 jam sebelum", desc: "Pengingat terakhir" },
            { value: "followup", label: "Follow-up pasca-kunjungan", desc: "Terima kasih + tawarkan booking ulang" },
            { value: "review", label: "Minta review", desc: "Kumpulkan testimoni & rating" },
          ],
        },
        {
          type: "cards",
          label: "Kebijakan pembayaran",
          key: "payment_policy",
          hint: "Bagaimana pelanggan membayar untuk mengamankan slot.",
          options: [
            { value: "pay_onsite", label: "Bayar di tempat", desc: "Tanpa pembayaran online. Paling sederhana." },
            { value: "deposit", label: "DP / Deposit online", desc: "Bayar sebagian untuk kunci slot — menekan no-show." },
            { value: "full", label: "Bayar penuh online", desc: "Lunas saat booking. Cocok untuk kelas/sesi berbayar." },
            { value: "free", label: "Gratis / tanpa bayar", desc: "Reservasi tanpa biaya." },
          ],
        },
        {
          type: "toggle",
          label: "Aktifkan waitlist saat slot penuh",
          key: "enable_waitlist",
          hint: "Pelanggan bisa masuk daftar tunggu; otomatis ditawari jika ada slot kosong.",
        },
        {
          type: "textarea",
          label: "Kebijakan reschedule / pembatalan (opsional)",
          key: "reschedule_policy",
          placeholder: "Contoh: reschedule maksimal H-1, DP hangus jika cancel di hari-H...",
          hint: "Aturan agar jadwal tetap terkelola. Kosongkan dan tim ScaleUp buatkan standar.",
        },
      ],
    },
    {
      title: "Dashboard & Kelola Booking (Dikerjakan ScaleUp)",
      subtitle:
        "Tim ScaleUp merakit sistem booking, halaman reservasi, dan otomatisasinya. Anda tinggal terima & kelola jadwal.",
      auto: true,
      fields: [
        {
          type: "info",
          label: "Yang kami rakit & serahkan",
          hint: "Halaman booking online (bisa ditempel ke website/WA/IG bio), form reservasi, kalender slot real-time, koneksi WhatsApp/email, dan alur konfirmasi + reminder otomatis.",
        },
        {
          type: "info",
          label: "Kalender & manajemen jadwal",
          hint: "Lihat semua booking dalam kalender, reschedule/cancel dengan sekali klik, blokir slot saat libur, dan atur ketersediaan per staff.",
        },
        {
          type: "info",
          label: "Tekan no-show",
          hint: "Reminder otomatis + opsi DP terbukti menurunkan pelanggan yang tidak datang — slot Anda tidak terbuang.",
        },
        {
          type: "info",
          label: "Report & okupansi",
          hint: "Pantau booking masuk, tingkat okupansi slot, no-show rate, jam & layanan terpopuler — untuk atur kapasitas & promo.",
        },
        {
          type: "info",
          label: "Optimasi berkala",
          hint: "Report bulanan + penyesuaian slot, reminder, dan kebijakan agar konversi booking dan kehadiran terus naik.",
        },
      ],
    },
  ],
  suggestions: [
    "Jual sebagai layanan RECURRING 'Booking Managed': ScaleUp yang rawat kalender, optimasi reminder, dan kirim report okupansi bulanan — sistem booking butuh perawatan, jadi alasan langganan berjalan.",
    "Dorong DP/deposit online sebagai fitur unggulan: menekan no-show yang selama ini merugikan klinik/salon — nilai jual yang sangat konkret ke klien.",
    "Sambungkan ke Website Builder (tombol 'Booking' di situs), CRM (booking → kontak & follow-up), dan Customer Support — booking jadi pintu masuk data pelanggan, bukan sekadar jadwal.",
    "Bangun template booking per-industri (klinik, salon, gigi, konsultan, studio foto, bengkel, coworking) agar onboarding klien cepat dan jadi bukti keahlian vertikal.",
    "Tawarkan add-on integrasi Google Calendar / WhatsApp Business API sebagai upsell margin tinggi untuk klien yang timnya sudah besar.",
  ],
};
