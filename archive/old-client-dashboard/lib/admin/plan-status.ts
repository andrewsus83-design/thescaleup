export type PlanItemStatus =
  | "propose"
  | "approved"
  | "on_going"
  | "done"
  | "rejected";

export const PLAN_ITEM_STATUSES: {
  value: PlanItemStatus;
  label: string;
  badge: string;
}[] = [
  { value: "propose", label: "Propose", badge: "border-warn/30 bg-warn/10 text-warn" },
  { value: "approved", label: "Approved", badge: "border-coral/30 bg-coral/10 text-coral" },
  { value: "on_going", label: "On Going", badge: "border-sky-500/30 bg-sky-500/10 text-sky-400" },
  { value: "done", label: "DONE", badge: "border-good/30 bg-good/10 text-good" },
  { value: "rejected", label: "Rejected", badge: "border-bad/30 bg-bad/10 text-bad" },
];

export function planStatusMeta(v?: string | null) {
  return (
    PLAN_ITEM_STATUSES.find((s) => s.value === v) ?? {
      value: (v as PlanItemStatus) ?? "propose",
      label: v ?? "—",
      badge: "border-white/15 bg-white/5 text-slate-400",
    }
  );
}

export const PLAN_CATEGORIES: Record<string, string> = {
  cmo: "CMO",
  cbo: "CBO",
  cto: "CTO",
  creative: "Creative",
  general: "Umum",
};

export const INVOICE_STATUSES = ["draft", "sent", "paid", "void"] as const;

/** Default Terms & Conditions attached to every invoice (admin can edit). */
export const DEFAULT_INVOICE_TERMS = `1. Pembayaran 50% di muka sebagai tanda mulai, 50% saat serah terima (untuk paket proyek).
2. Timeline pengerjaan dihitung sejak pembayaran pertama & kelengkapan aset/akses dari klien diterima.
3. Termasuk 2x revisi mayor per deliverable; revisi tambahan di luar itu dihitung sebagai add-on.
4. Scope pekerjaan sesuai daftar tugas di atas. Permintaan di luar scope dihitung terpisah.
5. Klien menyediakan akses & aset (akun, logo, data) maksimal 3 hari kerja setelah invoice terbit.
6. Untuk layanan berlangganan (retainer): pembayaran di awal tiap periode; pembatalan minimal H-14.
7. Harga belum termasuk biaya pihak ketiga (ad spend, domain, tools berbayar) kecuali disebutkan.`;

export function invoiceBadge(status?: string | null): string {
  switch (status) {
    case "paid":
      return "border-good/30 bg-good/10 text-good";
    case "sent":
      return "border-sky-500/30 bg-sky-500/10 text-sky-400";
    case "void":
      return "border-bad/30 bg-bad/10 text-bad";
    default:
      return "border-warn/30 bg-warn/10 text-warn";
  }
}
