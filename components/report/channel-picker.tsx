"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, Layers, Share2, Globe } from "lucide-react";

type ClientCh = { id: string; name: string; handle?: string | null; social: boolean; web: boolean };

/** Channel picker (accordion): per client, tick the connected channels —
 *  social media and/or web — to view. Multiple ticks → combined. */
export function ChannelPicker({
  clients,
  socialIds,
  webIds,
}: {
  clients: ClientCh[];
  socialIds: string[];
  webIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (clients.length === 0) return null;

  function go(social: string[], web: string[]) {
    const q = new URLSearchParams();
    if (social.length) q.set("clients", social.join(","));
    if (web.length) q.set("webs", web.join(","));
    const s = q.toString();
    router.push(`/report/admin${s ? `?${s}` : ""}`);
  }
  function toggleSocial(id: string) {
    const s = new Set(socialIds);
    s.has(id) ? s.delete(id) : s.add(id);
    go([...s], webIds);
  }
  function toggleWeb(id: string) {
    const w = new Set(webIds);
    w.has(id) ? w.delete(id) : w.add(id);
    go(socialIds, [...w]);
  }

  const totalSel = socialIds.length + webIds.length;
  const label =
    totalSel === 0
      ? "Pilih channel"
      : totalSel === 1
        ? (() => {
            const c = clients.find((x) => x.id === (socialIds[0] ?? webIds[0]));
            return c ? `${c.name} · ${socialIds.length ? "Social" : "Web"}` : "1 channel";
          })()
        : `${totalSel} channel`;

  const Row = ({ on, onClick, icon, text, sub }: { on: boolean; onClick: () => void; icon: React.ReactNode; text: string; sub?: string }) => (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
    >
      <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? "border-[#2A2870] bg-[#2A2870] text-white" : "border-slate-300"}`}>
        {on && <Check className="h-3 w-3" />}
      </span>
      {icon}
      <span className="flex-1 truncate">
        {text}
        {sub && <span className="text-slate-400"> · {sub}</span>}
      </span>
    </button>
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-2.5 text-sm font-semibold text-[#1B2A4A] hover:bg-slate-50"
      >
        {totalSel > 1 && <Layers className="h-4 w-4 text-[#2A2870]" />}
        {label}
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 max-h-96 w-80 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <p className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Pilih channel (social &amp; web) · centang untuk gabungan
            </p>
            {clients.map((c) => (
              <div key={c.id} className="mb-1 rounded-lg border border-slate-100 p-1.5">
                <p className="px-1 pb-1 text-xs font-bold text-[#1B2A4A]">{c.name}</p>
                <Row
                  on={socialIds.includes(c.id)}
                  onClick={() => toggleSocial(c.id)}
                  icon={<Share2 className="h-4 w-4 text-pink-500" />}
                  text="Social media"
                  sub={c.handle ? `@${c.handle}` : c.social ? "terhubung" : "belum"}
                />
                <Row
                  on={webIds.includes(c.id)}
                  onClick={() => toggleWeb(c.id)}
                  icon={<Globe className="h-4 w-4 text-[#2A2870]" />}
                  text="Web"
                  sub={c.web ? "terhubung" : "belum ada"}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
