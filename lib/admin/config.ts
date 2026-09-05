import {
  LayoutDashboard,
  Users,
  FileText,
  CalendarDays,
  Images,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/** Emails allowed into the admin backend (comma-separated env override). */
export const ADMIN_EMAILS: string[] = (
  process.env.ADMIN_EMAILS ?? "andrewsus83@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

export type MemberStatus =
  | "pending"
  | "processing"
  | "done"
  | "prospect"
  | "joined"
  | "rejected";

export const MEMBER_STATUSES: {
  value: MemberStatus;
  label: string;
  desc: string;
  badge: string;
  dot: string;
}[] = [
  {
    value: "pending",
    label: "Pending",
    desc: "Sudah isi form, belum diproses admin",
    badge: "border-warn/30 bg-warn/10 text-warn",
    dot: "bg-warn",
  },
  {
    value: "processing",
    label: "Processing",
    desc: "Sedang diriset & dibuatkan report",
    badge: "border-sky-500/30 bg-sky-500/10 text-sky-400",
    dot: "bg-sky-400",
  },
  {
    value: "done",
    label: "Done",
    desc: "Report sudah selesai digenerate",
    badge: "border-coral/30 bg-coral/10 text-coral",
    dot: "bg-coral",
  },
  {
    value: "prospect",
    label: "Prospect",
    desc: "Report terkirim, menunggu jawaban klien",
    badge: "border-violet-500/30 bg-violet-500/10 text-violet-400",
    dot: "bg-violet-400",
  },
  {
    value: "joined",
    label: "Joined",
    desc: "Sudah berlangganan & di-flag admin",
    badge: "border-good/30 bg-good/10 text-good",
    dot: "bg-good",
  },
  {
    value: "rejected",
    label: "Rejected",
    desc: "Ditolak / tidak diproses",
    badge: "border-bad/30 bg-bad/10 text-bad",
    dot: "bg-bad",
  },
];

export function statusMeta(status?: string | null) {
  return (
    MEMBER_STATUSES.find((s) => s.value === status) ?? {
      value: (status as MemberStatus) ?? "pending",
      label: status ?? "—",
      desc: "",
      badge: "border-white/15 bg-white/5 text-slate-400",
      dot: "bg-slate-400",
    }
  );
}

export const adminNav: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/members", label: "Member", icon: Users },
  { href: "/admin/reports", label: "Report", icon: FileText },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/assets", label: "Assets", icon: Images },
  { href: "/admin/settings", label: "Setting", icon: Settings },
  { href: "/admin/users", label: "User", icon: ShieldCheck },
];

/** API providers configurable in Settings. */
export const API_PROVIDERS: { key: string; label: string; hint: string }[] = [
  { key: "claude", label: "Claude (Anthropic)", hint: "sk-ant-..." },
  { key: "openai", label: "OpenAI", hint: "sk-..." },
  { key: "gemini", label: "Google Gemini", hint: "AIza..." },
  { key: "perplexity", label: "Perplexity", hint: "pplx-..." },
  { key: "apify", label: "Apify", hint: "apify_api_..." },
  { key: "firecrawl", label: "Firecrawl", hint: "fc-..." },
  { key: "serp", label: "SERP API", hint: "serp api key" },
  { key: "zernio", label: "Zernio", hint: "zernio token / webhook" },
];
