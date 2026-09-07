import type { BuilderConfig } from "@/lib/builders/wizard-types";

export const content: BuilderConfig = {
  "slug": "content",
  "title": "Content Builder",
  "persona": "Sebagai CMO ScaleUp: growth-driven, fokus pada UMKM & brand lokal Indonesia. Filosofi builder ini adalah pipeline konten sekali jalan — dari ide sampai laporan — yang ramah pemula tapi cukup detail agar tim kreatif ScaleUp bisa langsung eksekusi tanpa bolak-balik brief. Bahasa membumi, minim jargon, setiap step punya output yang jelas.",
  "steps": [
    {
      "title": "Ideation",
      "subtitle": "Tentukan arah konten: pilar, tema, siapa yang dituju, dan kata kunci. Ini fondasi semua step berikutnya.",
      "fields": [
        {
          "type": "cards",
          "label": "Pilar Konten Utama",
          "key": "content_pillar",
          "hint": "Pilih satu pilar dominan untuk konten ini. Pilar menjaga feed tetap konsisten.",
          "options": [
            {
              "value": "edukasi",
              "label": "Edukasi",
              "desc": "Tips, how-to, insight yang bikin audiens makin pintar soal produk/kategori."
            },
            {
              "value": "promosi",
              "label": "Promosi & Penawaran",
              "desc": "Diskon, launching, bundling — konten yang dorong penjualan langsung."
            },
            {
              "value": "inspirasi",
              "label": "Inspirasi & Storytelling",
              "desc": "Cerita brand, journey, use case yang membangun emosi & trust."
            },
            {
              "value": "entertainment",
              "label": "Entertainment / Trend",
              "desc": "Konten hiburan, ikut tren/audio viral untuk jangkauan luas."
            },
            {
              "value": "social_proof",
              "label": "Social Proof",
              "desc": "Testimoni, review, UGC, before-after yang menguatkan kredibilitas."
            },
            {
              "value": "bts",
              "label": "Behind The Scenes",
              "desc": "Proses produksi, tim, dapur brand — bangun kedekatan & keaslian."
            }
          ]
        },
        {
          "type": "text",
          "label": "Tema / Judul Kampanye",
          "key": "campaign_theme",
          "placeholder": "Contoh: Promo Gajian Akhir Bulan / Edukasi Skincare Pemula",
          "hint": "Satu tema payung agar konten periode ini nyambung satu sama lain."
        },
        {
          "type": "textarea",
          "label": "Target Audiens",
          "key": "target_audience",
          "placeholder": "Contoh: Wanita 22-35 th, ibu muda di kota besar, budget-conscious, aktif di IG & TikTok, cari produk praktis.",
          "hint": "Semakin spesifik (usia, lokasi, minat, pain point), semakin tajam kontennya."
        },
        {
          "type": "select",
          "label": "Tujuan Konten",
          "key": "content_goal",
          "hint": "Menentukan gaya dan metrik yang dikejar di step Report.",
          "options": [
            {
              "value": "awareness",
              "label": "Awareness (dikenal lebih luas)"
            },
            {
              "value": "engagement",
              "label": "Engagement (interaksi & komunitas)"
            },
            {
              "value": "traffic",
              "label": "Traffic (arahkan ke web/link)"
            },
            {
              "value": "conversion",
              "label": "Konversi (jualan / leads)"
            },
            {
              "value": "retention",
              "label": "Retensi (pelanggan lama loyal)"
            }
          ]
        },
        {
          "type": "text",
          "label": "Keyword Utama",
          "key": "primary_keyword",
          "placeholder": "Contoh: skincare lokal, kopi susu gula aren",
          "hint": "Kata kunci utama untuk SEO blog / caption / hashtag riset."
        },
        {
          "type": "text",
          "label": "Keyword Pendukung (opsional)",
          "key": "secondary_keywords",
          "placeholder": "Pisahkan dengan koma: serum vitamin c, glowing, murah",
          "hint": "Variasi kata kunci untuk memperluas jangkauan pencarian."
        }
      ]
    },
    {
      "title": "Creation",
      "subtitle": "Ubah ide jadi materi siap produksi: brief, format, aset visual, dan draft caption.",
      "fields": [
        {
          "type": "multiselect",
          "label": "Format Konten",
          "key": "content_format",
          "hint": "Boleh pilih lebih dari satu bila satu ide dipecah ke beberapa format.",
          "options": [
            {
              "value": "feed_single",
              "label": "Feed Single Image",
              "desc": "1 gambar statis untuk IG/FB."
            },
            {
              "value": "carousel",
              "label": "Carousel",
              "desc": "Multi-slide, cocok untuk edukasi & storytelling."
            },
            {
              "value": "reels",
              "label": "Reels / Short Video",
              "desc": "Video vertikal <90 detik, jangkauan tinggi."
            },
            {
              "value": "story",
              "label": "Story",
              "desc": "Konten 24 jam, interaktif (poll, Q&A, link)."
            },
            {
              "value": "tiktok",
              "label": "TikTok Video",
              "desc": "Video native TikTok, ikut tren/audio."
            },
            {
              "value": "blog",
              "label": "Artikel Blog",
              "desc": "Long-form untuk SEO & otoritas brand."
            }
          ]
        },
        {
          "type": "textarea",
          "label": "Creative Brief",
          "key": "creative_brief",
          "placeholder": "Jelaskan alur/visual yang diinginkan, hook di 3 detik pertama, poin yang wajib ada, dan gaya editing.",
          "hint": "Brief detail = revisi lebih sedikit. Tulis seolah menjelaskan ke desainer/videografer."
        },
        {
          "type": "text",
          "label": "Pesan Utama (Key Message)",
          "key": "key_message",
          "placeholder": "Satu kalimat inti yang harus nempel di benak audiens.",
          "hint": "Kalau audiens cuma ingat 1 hal, ini yang harus mereka ingat."
        },
        {
          "type": "textarea",
          "label": "Draft Caption / Script",
          "key": "caption_draft",
          "placeholder": "Tulis caption atau script narasi. Awali dengan hook kuat.",
          "hint": "Boleh draft kasar — tim copywriter ScaleUp akan poles sesuai brand voice."
        },
        {
          "type": "text",
          "label": "Call To Action (CTA)",
          "key": "call_to_action",
          "placeholder": "Contoh: Klik link di bio, Komen 'MAU', DM untuk order",
          "hint": "Ajakan konkret yang menuntun audiens ke tujuan konten."
        },
        {
          "type": "text",
          "label": "Hashtag (opsional)",
          "key": "hashtags",
          "placeholder": "#skincarelokal #glowingnatural #umkmnaikkelas",
          "hint": "Campur hashtag besar, medium, dan niche/branded."
        },
        {
          "type": "image",
          "label": "Aset Visual / Referensi Gambar",
          "key": "visual_assets",
          "hint": "Upload logo, foto produk, atau contoh visual yang diinginkan."
        },
        {
          "type": "url",
          "label": "Link Referensi (opsional)",
          "key": "reference_link",
          "placeholder": "https://... (konten inspirasi / kompetitor / mood board)",
          "hint": "Tautan konten yang jadi acuan gaya atau format."
        },
        {
          "type": "color",
          "label": "Warna Brand Dominan",
          "key": "brand_color",
          "hint": "Dipakai agar visual konsisten dengan identitas brand."
        }
      ]
    },
    {
      "title": "Approval",
      "subtitle": "Review dan setujui materi sebelum tayang. Satu pintu approval agar tidak ada konten meleset dari brand.",
      "fields": [
        {
          "type": "text",
          "label": "Reviewer / PIC Approval",
          "key": "reviewer_name",
          "placeholder": "Nama pihak brand yang berwenang menyetujui",
          "hint": "Orang yang keputusannya final untuk tayang."
        },
        {
          "type": "radio",
          "label": "Status Approval",
          "key": "approval_status",
          "hint": "Status ini menentukan apakah konten lanjut ke step Publish.",
          "options": [
            {
              "value": "draft",
              "label": "Draft",
              "desc": "Masih disiapkan, belum minta review."
            },
            {
              "value": "in_review",
              "label": "Menunggu Review",
              "desc": "Sudah dikirim, tunggu keputusan reviewer."
            },
            {
              "value": "revision",
              "label": "Perlu Revisi",
              "desc": "Ada catatan yang harus diperbaiki dulu."
            },
            {
              "value": "approved",
              "label": "Disetujui",
              "desc": "Lolos, siap dijadwalkan tayang."
            }
          ]
        },
        {
          "type": "textarea",
          "label": "Catatan Revisi / Approval",
          "key": "review_notes",
          "placeholder": "Tulis poin yang perlu diperbaiki atau catatan persetujuan.",
          "hint": "Spesifik & merujuk ke bagian tertentu agar revisi cepat."
        },
        {
          "type": "text",
          "label": "Deadline Approval",
          "key": "approval_deadline",
          "placeholder": "Contoh: 12 Sep 2026, pukul 17.00",
          "hint": "Batas waktu keputusan agar jadwal tayang tidak mundur."
        }
      ]
    },
    {
      "title": "Publish",
      "subtitle": "Atur di mana dan kapan konten tayang. Terintegrasi dengan kalender konten ScaleUp.",
      "fields": [
        {
          "type": "multiselect",
          "label": "Platform Tayang",
          "key": "publish_platform",
          "hint": "Pilih semua platform tujuan. Format akan disesuaikan per platform.",
          "options": [
            {
              "value": "ig_feed",
              "label": "Instagram Feed"
            },
            {
              "value": "ig_reels",
              "label": "Instagram Reels"
            },
            {
              "value": "ig_story",
              "label": "Instagram Story"
            },
            {
              "value": "tiktok",
              "label": "TikTok"
            },
            {
              "value": "facebook",
              "label": "Facebook"
            },
            {
              "value": "blog",
              "label": "Blog / Website"
            }
          ]
        },
        {
          "type": "radio",
          "label": "Tipe Publikasi",
          "key": "publish_type",
          "options": [
            {
              "value": "scheduled",
              "label": "Terjadwal",
              "desc": "Tayang otomatis pada tanggal & jam tertentu."
            },
            {
              "value": "now",
              "label": "Publish Sekarang",
              "desc": "Langsung tayang setelah disetujui."
            },
            {
              "value": "draft_platform",
              "label": "Simpan sebagai Draft",
              "desc": "Siapkan di platform, tayang manual nanti."
            }
          ]
        },
        {
          "type": "text",
          "label": "Jadwal Tayang",
          "key": "publish_schedule",
          "placeholder": "Contoh: 15 Sep 2026, pukul 19.00 (prime time)",
          "hint": "Rekomendasi ScaleUp: tayang di jam aktif audiens (biasanya 11-13 & 19-21 WIB)."
        },
        {
          "type": "toggle",
          "label": "Sesuaikan Otomatis per Platform",
          "key": "cross_post",
          "hint": "Aktifkan agar rasio/format & caption dioptimasi tim ScaleUp untuk tiap platform."
        },
        {
          "type": "url",
          "label": "Link Tujuan / Landing (opsional)",
          "key": "destination_link",
          "placeholder": "https://... (link produk, katalog, WhatsApp)",
          "hint": "Link yang dituju dari CTA/bio untuk tracking konversi."
        }
      ]
    },
    {
      "title": "Report & Analytic",
      "subtitle": "Laporan performa disusun otomatis oleh tim ScaleUp — Anda cukup terima insight & rekomendasi.",
      "auto": true,
      "fields": [
        {
          "type": "info",
          "label": "Dikerjakan Otomatis oleh ScaleUp",
          "hint": "Setelah konten tayang, ScaleUp menarik data dari tiap platform dan menyusun laporan periodik. Anda tidak perlu mengisi apa pun di step ini."
        },
        {
          "type": "info",
          "label": "Metrik Reach & Awareness",
          "hint": "Impressions, reach, views, follower growth, dan share of voice untuk mengukur seberapa luas konten dikenal."
        },
        {
          "type": "info",
          "label": "Metrik Engagement",
          "hint": "Likes, komentar, share, saves, watch time, dan engagement rate untuk mengukur kualitas interaksi."
        },
        {
          "type": "info",
          "label": "Metrik Konversi",
          "hint": "Link click, CTR, leads/DM masuk, dan konversi penjualan yang bisa dilacak dari CTA & destination link."
        },
        {
          "type": "info",
          "label": "Insight & Rekomendasi Next Cycle",
          "hint": "ScaleUp merangkum konten mana yang perform terbaik dan rekomendasi optimasi untuk siklus ideation berikutnya."
        }
      ]
    }
  ],
  "suggestions": [
    "Aktifkan loop data: alirkan insight dari step 5 (Report) balik ke step 1 (Ideation) sebagai 'saran tema berbasis performa'. Ini yang mengubah builder dari sekali pakai jadi engine recurring — klien makin ketergantungan karena tiap siklus makin tajam.",
    "Jual dalam paket retainer bulanan berbasis kuota konten (misal 12/20/30 konten per bulan) dengan step Report sebagai deliverable premium. Karena reporting otomatis dan berulang, ini pendapatan recurring dengan margin tinggi.",
    "Tambahkan template & preset per industri (F&B, fashion, skincare, jasa) yang auto-mengisi pilar, tone, dan rekomendasi format — mempercepat onboarding UMKM baru dan menaikkan perceived value.",
    "Sisipkan AI-assist di step Creation (generate 3 varian caption + rekomendasi hashtag dari keyword step 1) untuk menekan waktu produksi, lalu posisikan sebagai fitur add-on berbayar.",
    "Buat dashboard kalender konten kolaboratif dengan notifikasi approval (WhatsApp/email) agar step 3 & 4 tidak macet; kecepatan approval jadi selling point dan alasan klien perpanjang langganan."
  ]
};
