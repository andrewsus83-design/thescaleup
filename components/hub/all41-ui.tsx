import { cn } from "@/lib/utils";

/**
 * All41 Hub layout primitives. Keep brand tokens in app/hub/all41-hub.css.
 * These are presentation-only and can be used from server or client components.
 */
export function HubSection({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
  id,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = id ?? undefined;
  return (
    <section aria-labelledby={headingId} className={cn("space-y-5", className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="all41-section-eyebrow mb-2">{eyebrow}</p>}
          <h2 id={headingId} className="font-title text-h3 font-extrabold tracking-tight text-ink-800">
            {title}
          </h2>
          {description && <p className="mt-2 max-w-2xl text-small text-ink-500">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function HubSurface({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  const classes = cn("all41-surface p-5 sm:p-6", className);
  if (as === "section") return <section className={classes}>{children}</section>;
  if (as === "article") return <article className={classes}>{children}</article>;
  return <div className={classes}>{children}</div>;
}

export function HubKpi({
  label,
  value,
  detail,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <HubSurface className={cn("min-w-0", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-small font-medium text-ink-500">{label}</p>
        {icon && <span aria-hidden className="all41-module-icon inline-flex size-9 items-center justify-center rounded-field">{icon}</span>}
      </div>
      <p className="mt-3 break-words font-title text-h2 font-extrabold text-ink-800">{value}</p>
      {detail && <p className="mt-2 text-caption text-ink-500">{detail}</p>}
    </HubSurface>
  );
}
