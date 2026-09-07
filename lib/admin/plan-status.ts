export type PlanItemStatus =
  | "approval"
  | "pending"
  | "backlog"
  | "on_progress"
  | "in_review"
  | "implemented"
  | "done";

export const PLAN_ITEM_STATUSES: {
  value: PlanItemStatus;
  label: string;
  badge: string;
}[] = [
  { value: "approval", label: "Approval", badge: "border-violet-500/30 bg-violet-500/10 text-violet-400" },
  { value: "pending", label: "Pending", badge: "border-warn/30 bg-warn/10 text-warn" },
  { value: "backlog", label: "Backlog", badge: "border-white/15 bg-white/5 text-slate-400" },
  { value: "on_progress", label: "On Progress", badge: "border-sky-500/30 bg-sky-500/10 text-sky-400" },
  { value: "in_review", label: "In Review", badge: "border-coral/30 bg-coral/10 text-coral" },
  { value: "implemented", label: "Implemented", badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  { value: "done", label: "Done", badge: "border-good/30 bg-good/10 text-good" },
];

export function planStatusMeta(v?: string | null) {
  return (
    PLAN_ITEM_STATUSES.find((s) => s.value === v) ?? {
      value: (v as PlanItemStatus) ?? "backlog",
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
