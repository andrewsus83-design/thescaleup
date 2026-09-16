import Link from "next/link";

/** Sub-navigation for a client: Overview | Setting (API) | Report. */
export function ClientSubnav({
  id,
  active,
  configuredCount = 0,
}: {
  id: string;
  active: "overview" | "settings";
  configuredCount?: number;
}) {
  const tabs = [
    { key: "overview", label: "Ringkasan", href: `/report/admin/${id}` },
    {
      key: "settings",
      label: `Setting API${configuredCount ? ` · ${configuredCount}` : ""}`,
      href: `/report/admin/${id}/settings`,
    },
  ] as const;
  return (
    <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
            active === t.key ? "bg-[#2A2870] text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
