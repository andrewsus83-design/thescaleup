import type { BuilderConfig } from "@/lib/builders/wizard-types";

export const tasks: BuilderConfig = {
  "slug": "tasks",
  "title": "Task Management",
  "persona": "CTO ScaleUp — arsitek sistem operasional tim yang scalable.",
  "steps": [
    {
      "title": "Setup Board & Alur Kerja (SOP)",
      "subtitle": "Tentukan struktur board dan cara tim Anda bergerak dari ide sampai selesai. Ini fondasi eksekusi tim.",
      "fields": [
        {
          "type": "text",
          "label": "Nama Board / Proyek",
          "key": "board_name",
          "placeholder": "Contoh: Operasional Toko — Q4 2026",
          "hint": "Satu board = satu tim atau satu area kerja. Jangan campur semua divisi jadi satu."
        },
        {
          "type": "cards",
          "label": "Metode Kerja Tim",
          "key": "workflow_method",
          "hint": "Pilih yang paling cocok dengan ritme tim Anda sekarang — bisa diubah nanti.",
          "options": [
            {
              "value": "kanban",
              "label": "Kanban (Alur Kartu)",
              "desc": "Tugas mengalir lewat kolom: To Do → Progress → Done. Paling fleksibel untuk operasional harian & tim kecil."
            },
            {
              "value": "sprint",
              "label": "Sprint Mingguan",
              "desc": "Kerja dibagi per periode 1-2 minggu dengan target jelas. Cocok untuk tim yang butuh fokus & deadline ketat."
            },
            {
              "value": "simple_list",
              "label": "Checklist Sederhana",
              "desc": "Daftar tugas lurus dengan status selesai/belum. Paling ringan untuk tim 1-3 orang."
            },
            {
              "value": "calendar",
              "label": "Berbasis Kalender",
              "desc": "Tugas ditata di tanggal jatuh tempo. Cocok kalau pekerjaan didorong oleh event & tenggat."
            }
          ]
        },
        {
          "type": "multiselect",
          "label": "Kolom / Tahapan Board",
          "key": "board_columns",
          "hint": "Pilih tahapan yang benar-benar dilalui tugas Anda. 4 sampai 6 kolom ideal.",
          "options": [
            {
              "value": "backlog",
              "label": "Backlog / Ide",
              "desc": "Tampungan ide & tugas yang belum dijadwalkan"
            },
            {
              "value": "todo",
              "label": "To Do",
              "desc": "Sudah siap dikerjakan minggu ini"
            },
            {
              "value": "in_progress",
              "label": "In Progress",
              "desc": "Sedang dikerjakan"
            },
            {
              "value": "review",
              "label": "Review / Approval",
              "desc": "Menunggu pengecekan atau persetujuan"
            },
            {
              "value": "blocked",
              "label": "Blocked / Kendala",
              "desc": "Terhambat, butuh keputusan atau input orang lain"
            },
            {
              "value": "done",
              "label": "Done / Selesai",
              "desc": "Tuntas & terverifikasi"
            }
          ]
        },
        {
          "type": "textarea",
          "label": "SOP & Definition of Done",
          "key": "sop_notes",
          "placeholder": "Contoh: Tugas boleh masuk 'Done' hanya setelah di-review PIC. Tugas 'Blocked' > 2 hari wajib dieskalasi ke owner.",
          "hint": "Aturan singkat kapan tugas dianggap selesai & bagaimana perpindahan antar kolom."
        },
        {
          "type": "color",
          "label": "Warna Aksen Board (opsional)",
          "key": "board_accent_color",
          "hint": "Selaraskan dengan warna brand."
        }
      ]
    },
    {
      "title": "Tim & Kepemilikan (PIC)",
      "subtitle": "Daftarkan siapa di tim dan perannya. Setiap tugas punya satu PIC yang bertanggung jawab — bukan 'tim' yang abstrak.",
      "fields": [
        {
          "type": "textarea",
          "label": "Anggota Tim & Peran",
          "key": "team_members",
          "placeholder": "Andi — Admin Toko — WA 0812xxxx\nRina — Content — WA 0813xxxx\nBudi — CS & Packing — WA 0814xxxx",
          "hint": "Satu baris per orang: Nama — Peran — Kontak (WA/email). Kontak dipakai untuk notifikasi & assignment."
        },
        {
          "type": "text",
          "label": "Owner / Penanggung Jawab Board",
          "key": "board_owner",
          "placeholder": "Contoh: Andi (atau Anda sendiri)",
          "hint": "Orang berwenang menutup tugas, memutuskan prioritas, & menerima eskalasi."
        },
        {
          "type": "radio",
          "label": "Aturan Penugasan (Assignment)",
          "key": "assignment_rule",
          "hint": "Bagaimana tugas baru dibagikan ke tim.",
          "options": [
            {
              "value": "single_pic",
              "label": "1 Tugas = 1 PIC",
              "desc": "Setiap tugas punya satu penanggung jawab tunggal. Paling jelas & direkomendasikan."
            },
            {
              "value": "pic_plus_helper",
              "label": "PIC + Pendukung",
              "desc": "Ada 1 PIC utama plus anggota pendukung yang bisa membantu."
            },
            {
              "value": "role_based",
              "label": "Berdasarkan Peran",
              "desc": "Tugas otomatis diarahkan ke peran tertentu (mis. semua konten ke tim Content)."
            }
          ]
        },
        {
          "type": "toggle",
          "label": "Aktifkan Dependensi Antar Tugas",
          "key": "enable_dependencies",
          "hint": "Nyalakan jika ada tugas yang baru bisa mulai setelah tugas lain selesai (mis. 'Desain' sebelum 'Posting')."
        },
        {
          "type": "toggle",
          "label": "Notifikasi Otomatis ke Tim",
          "key": "enable_notifications",
          "hint": "Kirim pengingat ke PIC saat tugas mendekati/melewati tenggat lewat kanal yang dipilih di step berikutnya."
        }
      ]
    },
    {
      "title": "Input Tugas Awal & Prioritas",
      "subtitle": "Isi tugas pertama untuk mengisi board plus atur sistem prioritas & tenggat, agar board langsung siap pakai.",
      "fields": [
        {
          "type": "textarea",
          "label": "Daftar Tugas Awal",
          "key": "initial_tasks",
          "placeholder": "Judul | PIC | Prioritas | Tenggat\nUpdate katalog Shopee | Andi | Tinggi | 12 Sep\nBuat 8 konten IG | Rina | Sedang | 15 Sep\nFollow-up 20 leads WA | Budi | Tinggi | 10 Sep",
          "hint": "Satu baris per tugas: Judul | PIC | Prioritas | Tenggat. Cukup 5-15 tugas nyata minggu ini."
        },
        {
          "type": "radio",
          "label": "Skema Prioritas",
          "key": "priority_scheme",
          "hint": "Cara menandai mana yang didahulukan.",
          "options": [
            {
              "value": "high_med_low",
              "label": "Tinggi / Sedang / Rendah",
              "desc": "Paling intuitif untuk tim UMKM. Direkomendasikan."
            },
            {
              "value": "p0_p3",
              "label": "P0 – P3",
              "desc": "P0 = darurat, P3 = bisa ditunda. Gaya teknis/startup."
            },
            {
              "value": "moscow",
              "label": "MoSCoW",
              "desc": "Must / Should / Could / Won't. Bagus untuk memilah scope proyek besar."
            }
          ]
        },
        {
          "type": "toggle",
          "label": "Ada Tugas Rutin / Berulang?",
          "key": "enable_recurring",
          "hint": "Nyalakan untuk tugas berkala (laporan mingguan, restock bulanan). Kami buatkan template otomatisnya."
        },
        {
          "type": "select",
          "label": "Frekuensi Laporan Progres",
          "key": "report_frequency",
          "hint": "Seberapa sering Anda menerima rangkuman kemajuan tim.",
          "options": [
            {
              "value": "daily",
              "label": "Harian",
              "desc": "Ringkasan singkat tiap sore — operasional cepat"
            },
            {
              "value": "weekly",
              "label": "Mingguan",
              "desc": "Rekap tiap Senin/Jumat — paling seimbang. Direkomendasikan"
            },
            {
              "value": "biweekly",
              "label": "Dua Mingguan",
              "desc": "Untuk tim dengan siklus kerja lebih panjang"
            }
          ]
        },
        {
          "type": "select",
          "label": "Kanal Laporan & Notifikasi",
          "key": "report_channel",
          "hint": "Ke mana laporan & pengingat dikirim.",
          "options": [
            {
              "value": "whatsapp",
              "label": "WhatsApp",
              "desc": "Grup atau chat pribadi — paling cepat dibaca tim UMKM"
            },
            {
              "value": "email",
              "label": "Email",
              "desc": "Cocok untuk rekap formal & arsip"
            },
            {
              "value": "in_app",
              "label": "Notifikasi di Tool",
              "desc": "Langsung di aplikasi board (Notion/ClickUp/Trello)"
            }
          ]
        }
      ]
    },
    {
      "title": "Kami Bangun, Otomasi & Pantau",
      "subtitle": "Bagian ini dikerjakan tim ScaleUp — Anda tidak perlu isi apa pun.",
      "auto": true,
      "fields": [
        {
          "type": "info",
          "label": "Yang ScaleUp kerjakan untuk Anda",
          "hint": "1) Membangun board di tool pilihan (Notion / ClickUp / Trello) dengan kolom, SOP, dan warna brand. 2) Meng-input tugas awal + assign PIC, prioritas, tenggat, dependensi. 3) Menyetel otomatisasi: pengingat tenggat, notifikasi WA/email, template tugas berulang. 4) Membuat dashboard tracking (beban per orang, tugas telat, laju penyelesaian). 5) Mengirim laporan progres sesuai frekuensi & kanal pilihan Anda."
        },
        {
          "type": "info",
          "label": "Estimasi & serah terima",
          "hint": "Board siap pakai dalam 2-3 hari kerja. Kami adakan walkthrough singkat (±20 menit) agar tim paham cara update status. Setelah itu Anda cukup terima laporan berkala — kami pantau dan rapikan board tiap periode."
        }
      ]
    }
  ],
  "suggestions": [
    "Jadikan builder ini pintu masuk layanan RECURRING: paket 'Ops Management' bulanan di mana ScaleUp yang input tugas, kejar PIC, dan kirim laporan mingguan — board jadi alasan klien bayar tiap bulan, bukan sekali setup.",
    "Tambahkan template board siap-pakai per jenis bisnis UMKM (F&B, fashion online, jasa) sebagai opsi cards di step 1 — klien tinggal pilih, kecepatan setup & konversi naik.",
    "Sambungkan output ke CRM Builder & Content Builder: leads dari CRM otomatis jadi tugas follow-up, kalender konten otomatis jadi tugas di board — kunci upsell antar-builder.",
    "Kirim dashboard laporan otomatis via WhatsApp (rekap tugas telat + beban tim) sebagai bukti nilai bulanan — laporan rutin jadi pengingat halus kenapa klien harus tetap berlangganan.",
    "Batasi jumlah kolom & prioritas agar builder tetap simpel; simpan opsi lanjutan (dependensi, sprint, tugas berulang) di balik toggle agar UMKM pemula tidak overwhelmed tapi klien advanced tetap terlayani."
  ]
};
