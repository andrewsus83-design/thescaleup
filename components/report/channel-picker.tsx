"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, Layers, Share2, Globe, RotateCw, Music2 } from "lucide-react";

type Account = { id: string; platform: string; username?: string | null };
type ClientCh = { id: string; name: string; accounts: Account[]; web: boolean };

function platformIcon(p: string) {
  const pl = (p || "").toLowerCase();
  if (pl.includes("tiktok")) return <Music2 className="h-4 w-4 text-slate-800" />;
  return <Share2 className="h-4 w-4 text-pink-500" />;
}

/** Channel picker (accordion): per client, tick connected accounts (Instagram,
 *  TikTok, …) and/or web to view. Multiple ticks → combined. + Refresh accounts. */
export function ChannelPicker({
  clients,
  accountIds,
  webIds,
}: {
  clients: ClientCh[];
  accountIds: string[];
  webIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  if (clients.length === 0) return null;

  function go(accounts: string[], web: string[]) {
    const q = new URLSearchParams();
    if (accounts.length) q.set("accounts", accounts.join(","));
    if (web.length) q.set("webs", web.join(","));
    const s = q.toString();
    router.push(`/report/admin${s ? `?${s}` : ""}`);
  }
  const allAcc = clients.flatMap((c) => c.accounts);
  function toggleAcc(id: string) {
    if (accountIds.includes(id)) {
      go(accountIds.filter((x) => x !== id), webIds);
      return;
    }
    // only one platform per selection — picking a different platform replaces the set
    const plat = allAcc.find((a) => a.id === id)?.platform;
    const currentPlat = allAcc.find((a) => a.id === accountIds[0])?.platform;
    if (currentPlat && plat !== currentPlat) go([id], webIds);
    else go([...accountIds, id], webIds);
  }
  function toggleWeb(id: string) {
    const w = new Set(webIds);
    w.has(id) ? w.delete(id) : w.add(id);
    go(accountIds, [...w]);
  }

  const totalSel = accountIds.length + webIds.length;
  const label =
    totalSel === 0
      ? "Pilih channel"
      : totalSel === 1
        ? (() => {
            const a = allAcc.find((x) => x.id === accountIds[0]);
            if (a) return `${a.username ? "@" + a.username : a.platform}`;
            const wc = clients.find((c) => c.id === webIds[0]);
            return wc ? `${wc.name} · Web` : "1 channel";
          })()
        : `${totalSel} channel`;

  const Row = ({ on, onClick, icon, text, sub }: { on: boolean; onClick: () => void; icon: React.ReactNode; text: string; sub?: string }) => (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50">
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
          <div className="absolute left-0 z-20 mt-1 max-h-96 w-80 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <div className="flex items-center justify-between px-1 pb-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Pilih channel (social &amp; web)</p>
              <button
                type="button"
                onClick={() => {
                  setRefreshing(true);
                  router.refresh();
                  setTimeout(() => setRefreshing(false), 1200);
                }}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[#2A2870] hover:bg-slate-50"
                title="Muat ulang daftar akun dari Zernio"
              >
                <RotateCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>
            {clients.map((c) => (
              <div key={c.id} className="mb-1 rounded-lg border border-slate-100 p-1.5">
                <p className="px-1 pb-1 text-xs font-bold text-[#1B2A4A]">{c.name}</p>
                {c.accounts.length === 0 && <p className="px-1 pb-1 text-[11px] text-slate-400">Belum ada akun social. Klik Refresh.</p>}
                {c.accounts.map((a) => (
                  <Row
                    key={a.id}
                    on={accountIds.includes(a.id)}
                    onClick={() => toggleAcc(a.id)}
                    icon={platformIcon(a.platform)}
                    text={a.platform ? a.platform[0].toUpperCase() + a.platform.slice(1) : "Social"}
                    sub={a.username ? `@${a.username}` : undefined}
                  />
                ))}
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
