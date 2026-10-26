import Link from "next/link";
import { statusMeta } from "@/lib/admin/config";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-mist sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-slate-400">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/8 bg-card/40 p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status?: string | null }) {
  const m = statusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        m.badge,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon,
  href,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <div
      className={cn(
        "group flex items-center justify-between rounded-2xl border p-5 transition-colors",
        accent
          ? "border-coral/25 bg-coral/5"
          : "border-white/8 bg-card/40 hover:border-white/15",
        href && "cursor-pointer",
      )}
    >
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 font-display text-3xl font-extrabold text-mist">
          {value}
        </p>
      </div>
      {icon && (
        <span
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-xl",
            accent ? "bg-coral/15 text-coral" : "bg-white/5 text-slate-400",
          )}
        >
          {icon}
        </span>
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-card/20 px-6 py-16 text-center">
      {icon && (
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-500">
          {icon}
        </span>
      )}
      <p className="font-display font-semibold text-slate-200">{title}</p>
      {hint && <p className="mt-1.5 max-w-sm text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-slate-500",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3.5 align-middle", className)}>{children}</td>;
}
