// Shared metric catalog — description, formula (rumus), industry benchmark, and
// relation for every report metric. Used by BOTH the dashboard (hover tooltip)
// and the Excel export (cell notes) so the explanations are identical.
// Benchmarks are general Instagram guidance ("patokan umum") — they vary by niche
// and account size (akun kecil biasanya ber-rate lebih tinggi).

export type MetricInfo = {
  label: string;
  desc: string;
  rumus?: string;
  benchmark?: string;
  relation?: string;
};

export const METRIC_INFO: Record<string, MetricInfo> = {
  reach: {
    label: "Reach",
    desc: "Jumlah akun unik yang melihat konten Anda di periode ini.",
    rumus: "akun unik yang menjangkau (Instagram Insights)",
    benchmark: "Per post sehat ≈ 30–60% dari followers; makin tinggi makin luas.",
    relation: "Basis hampir semua rate (ER, saves rate, dll).",
  },
  impressions: {
    label: "Impressions",
    desc: "Total tayangan konten — satu orang bisa melihat lebih dari sekali.",
    rumus: "total tayangan",
    benchmark: "Impressions > reach = konten dilihat berulang (bagus untuk recall).",
    relation: "Impressions ÷ reach = frekuensi tayang.",
  },
  totalInteractions: {
    label: "Total Interaksi",
    desc: "Total semua aksi pada konten.",
    rumus: "likes + komentar + follows + profile visits + shared + saved + web click",
    benchmark: "Bandingkan antar periode; kejar tren naik.",
    relation: "Pembilang untuk ER (Reach).",
  },
  erReach: {
    label: "ER (Reach)",
    desc: "Engagement Rate atas reach — dari yang menjangkau, berapa yang berinteraksi.",
    rumus: "total interaksi ÷ reach",
    benchmark: "Umum IG: 1–3% baik, >5% sangat baik (akun kecil biasanya lebih tinggi).",
    relation: "Metrik kesehatan konten utama.",
  },
  accountsEngaged: {
    label: "Accounts Engaged",
    desc: "Jumlah akun unik yang melakukan minimal satu interaksi.",
    rumus: "akun unik berinteraksi",
    benchmark: "accounts engaged ÷ reach = ER berbasis orang (bukan aksi).",
    relation: "Melengkapi Total Interaksi yang menghitung aksi, bukan orang.",
  },
  likes: { label: "Likes", desc: "Interaksi paling ringan; sinyal apresiasi.", benchmark: "Volume tinggi bagus, tapi bobot algoritma paling rendah." },
  comments: { label: "Komentar", desc: "Sinyal engagement dalam; memicu percakapan.", benchmark: "Comments rate >0.1% dari reach = diskusi sehat.", relation: "Dinilai lebih tinggi dari like oleh algoritma." },
  shares: {
    label: "Shares",
    desc: "Konten dibagikan ke orang lain — pendorong utama jangkauan baru.",
    rumus: "jumlah share",
    benchmark: "Shares rate >0.5–1% dari reach = kuat (viralitas).",
    relation: "Naikkan reach non-follower.",
  },
  saved: {
    label: "Saved",
    desc: "Konten disimpan untuk dilihat lagi — sinyal niat tertinggi.",
    rumus: "jumlah save",
    benchmark: "Saves rate >0.5% dari reach = kuat.",
    relation: "Bobot algoritma tinggi; dorong lewat konten edukatif/referensi.",
  },
  follows: { label: "Follows", desc: "Follower baru yang didapat dari konten ini.", benchmark: "Follow rate 0.5–1% dari reach = konversi sehat.", relation: "Konversi paling langsung dari konten ke audiens." },
  webClicks: { label: "Web Clicks", desc: "Klik ke link (bio/CTA) — traffic keluar.", benchmark: "Relevan untuk konten yang mengarahkan ke web/produk.", relation: "Ukur niat menuju konversi di luar IG." },
  posts: { label: "Jumlah Post", desc: "Banyaknya post di periode ini.", benchmark: "Konsistensi cadence lebih penting dari volume.", relation: "Penyebut untuk Avg Reach/Post." },

  reachRate: {
    label: "Reach Rate",
    desc: "Amplifikasi: seberapa besar jangkauan dibanding basis follower.",
    rumus: "reach ÷ followers",
    benchmark: "Per post sehat ≈ 30–60% followers; >100% (>1×) = banyak discovery/viral.",
    relation: "Tinggi + non-follower reach tinggi = konten menyebar keluar audiens Anda.",
  },
  qualityScore: {
    label: "Content Quality Score",
    desc: "Kualitas konten: interaksi berbobot (saves & shares & follows dinilai lebih tinggi dari likes) per 1.000 reach.",
    rumus: "(likes×1 + komentar×2 + shares×3 + saved×4 + follows×5 + profileVisits×1 + webClicks×2) ÷ reach × 1000",
    benchmark: "Skor internal — bandingkan antar periode; naik = konten makin bernilai, bukan sekadar banyak like.",
    relation: "Melengkapi ER yang menganggap semua interaksi setara.",
  },
  savesRate: { label: "Saves Rate", desc: "Porsi yang menyimpan dari yang menjangkau.", rumus: "saved ÷ reach", benchmark: ">0.5% = kuat.", relation: "Sinyal simpan bernilai tinggi bagi algoritma." },
  sharesRate: { label: "Shares Rate", desc: "Porsi yang membagikan dari yang menjangkau.", rumus: "shares ÷ reach", benchmark: ">0.5–1% = kuat.", relation: "Pendorong utama reach non-follower." },
  pvRate: { label: "Profile Visit Rate", desc: "Porsi yang mengunjungi profil dari reach.", rumus: "profile visits ÷ reach", benchmark: "1–3% = konten mendorong orang cek profil.", relation: "Langkah funnel sebelum follow." },
  followRate: { label: "Follow Rate", desc: "Porsi yang follow dari yang menjangkau.", rumus: "follows ÷ reach", benchmark: "0.5–1% = konversi follower sehat.", relation: "Ujung funnel discovery → aksi." },
  netGrowth: { label: "Net Follower Growth", desc: "Pertumbuhan follower bersih di periode ini.", rumus: "followers gained − followers lost", benchmark: "Organik sehat ≈ 2–5%/bulan dari basis.", relation: "Hasil akumulasi Follow Rate dikurangi unfollow." },
  avgReach: { label: "Avg Reach / Post", desc: "Rata-rata jangkauan tiap post.", rumus: "reach ÷ jumlah post", benchmark: "Naik = tiap konten menjangkau lebih luas.", relation: "Normalisasi reach terhadap volume post." },

  comparison: {
    label: "Perbandingan vs Periode Sebelumnya",
    desc: "Perubahan metrik dibanding periode sepanjang yang sama tepat sebelum rentang ini.",
    rumus: "(periode ini − periode lalu) ÷ periode lalu",
    benchmark: "Positif konsisten = tren naik. Prioritas: reach, saves, shares.",
    relation: "Konteks arah — angka tinggi belum tentu naik.",
  },
  bestTime: {
    label: "Waktu Terbaik Posting",
    desc: "Hari & jam dengan rata-rata reach tertinggi (zona waktu WIB).",
    rumus: "rata-rata reach dikelompokkan per hari & per jam publish",
    benchmark: "Jadwalkan konten terpenting di slot ini; uji 2–3 minggu.",
    relation: "Maksimalkan reach awal → sinyal ke algoritma.",
  },
  discovery: {
    label: "Followers vs Non-followers",
    desc: "Porsi reach dari followers vs dari non-followers (discovery/explore).",
    rumus: "reach follower ÷ total reach, dan sebaliknya",
    benchmark: "Non-follower >50% = konten kuat menyebar keluar audiens.",
    relation: "Didorong oleh shares & saves; kunci pertumbuhan.",
  },
  contentType: {
    label: "Reach per Jenis Konten",
    desc: "Reach & interaksi per format (Reels, Carousel, Post, Story).",
    benchmark: "Alokasikan lebih banyak ke format yang paling efisien reach/interaksi.",
    relation: "Pandu keputusan mix konten.",
  },
  followerGrowth: {
    label: "Pertumbuhan Follower",
    desc: "Follower gained/lost + tren harian.",
    rumus: "gained − lost per hari (Zernio snapshot harian sejak akun terhubung)",
    benchmark: "Organik sehat ≈ 2–5%/bulan dari basis.",
    relation: "Hasil jangka panjang dari Follow Rate.",
  },
  viewRate: { label: "View Rate", desc: "Daya tarik hook Reels: tayangan dibanding jangkauan.", rumus: "views ÷ reach", benchmark: ">1× = ditonton berulang/loop; hook kuat.", relation: "Awal funnel retensi video." },
  completion: { label: "Completion Rate", desc: "Porsi penonton yang menonton sampai selesai.", rumus: "penonton selesai ÷ total penonton", benchmark: ">50% sangat baik untuk Reels.", relation: "Retensi tinggi → di-push algoritma." },
  skip: { label: "Skip Rate", desc: "Porsi yang men-skip cepat.", rumus: "skip ÷ tayangan", benchmark: "Makin rendah makin baik; hook 3 detik pertama kunci.", relation: "Kebalikan dari retensi." },
  avgWatch: { label: "Avg Watch Time", desc: "Rata-rata durasi menonton video.", rumus: "total watch time ÷ jumlah view", benchmark: "Makin lama relatif durasi video makin baik.", relation: "Pendukung Completion Rate." },
  overlap: {
    label: "Overlap Audiens",
    desc: "Porsi followers vs porsi yang benar-benar berinteraksi per segmen.",
    rumus: "Gap = %interaksi − %followers",
    benchmark: "Gap positif = segmen over-index (lebih aktif dari porsinya).",
    relation: "Sesuaikan konten, bahasa, & jam ke segmen dengan gap positif.",
  },
  pillar: {
    label: "Performa per Pillar",
    desc: "Kategori editorial konten (disarankan AI Claude) beserta reach & interaksinya.",
    benchmark: "Perbanyak pillar dengan reach/interaksi tertinggi.",
    relation: "Hubungkan tema konten dengan hasil.",
  },
};

/** Plain-text version of a metric's info for an Excel cell note. */
export function infoNote(id: string): string | null {
  const m = METRIC_INFO[id];
  if (!m) return null;
  const lines = [m.label, m.desc];
  if (m.rumus) lines.push(`Rumus: ${m.rumus}`);
  if (m.benchmark) lines.push(`Patokan bagus: ${m.benchmark}`);
  if (m.relation) lines.push(`Relasi: ${m.relation}`);
  return lines.join("\n");
}
