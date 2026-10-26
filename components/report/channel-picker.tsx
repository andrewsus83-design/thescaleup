"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, Layers, Share2, Globe, RotateCw, Music2, Megaphone } from "lucide-react";
import { btnCls, capsCls, motion } from "@/components/brand/styles";
import { cn } from "@/lib/utils";

type Account = { id: string; platform: string; username?: string | null };
type ClientCh = { id: string; name: string; accounts: Account[]; web: boolean };

/** Platform "family": organic + its ads share one family so they can be combined. */
function platformFamily(p: string) {
  const pl = (p || "").toLowerCase();
  if (pl.includes("tiktok")) return "tiktok";
  if (pl.includes("instagram") || pl.includes("facebook") || pl.includes("meta")) return "meta";
  return pl || "other";
}
function isAds(p: string) {
  const pl = (p || "").toLowerCase();
  return pl.includes("ads") || pl.includes("ad_account") || pl.includes("adaccount");
}
function platformLabel(p: string) {
  const pl = (p || "").toLowerCase();
  if (pl.includes("tiktok")) return isAds(pl) ? "TikTok Ads" : "TikTok";
  if (pl.includes("instagram")) return isAds(pl) ? "Instagram Ads" : "Instagram";
  if (pl.includes("facebook") || pl.includes("meta")) return isAds(pl) ? "Meta Ads" : "Meta";
  const base = p ? p[0].toUpperCase() + p.slice(1) : "Social";
  return base.replace(/_/g, " ");
}
function platformIcon(p: string) {
  const pl = (p || "").toLowerCase();
  if (isAds(pl)) return <Megaphone className="size-4 shrink-0 text-ink-500" aria-hidden />;
  if (pl.includes("tiktok")) return <Music2 className="size-4 shrink-0 text-ink-500" aria-hidden />;
  return <Share2 className="size-4 shrink-0 text-ink-500" aria-hidden />;
}

/** Channel picker (accordion): per client, tick connected accounts (Instagram,
 *  TikTok, …) and/or web to view. Multiple ticks → combined. + Refresh accounts. */
export function ChannelPicker({
  clients,
  accountIds,
  webIds,
  basePath = "/report/admin",
}: {
  clients: ClientCh[];
  accountIds: string[];
  webIds: string[];
  /** The page that shows the report: a pick navigates there with `?accounts=…&webs=…` (the Chat Room passes its own). */
  basePath?: string;
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
    router.push(`${basePath}${s ? `?${s}` : ""}`);
  }
  const allAcc = clients.flatMap((c) => c.accounts);
  function toggleAcc(id: string) {
    if (accountIds.includes(id)) {
      go(accountIds.filter((x) => x !== id), webIds);
      return;
    }
    // Same family can be combined (Instagram + Meta Ads, TikTok + TikTok Ads);
    // a different family (IG vs TikTok — different data) replaces the set.
    const fam = platformFamily(allAcc.find((a) => a.id === id)?.platform ?? "");
    const currentFam = platformFamily(allAcc.find((a) => a.id === accountIds[0])?.platform ?? "");
    if (accountIds.length && currentFam && fam !== currentFam) go([id], webIds);
    else go([...accountIds, id], webIds);
  }
  function toggleWeb(id: string) {
    const w = new Set(webIds);
    if (w.has(id)) w.delete(id);
    else w.add(id);
    go(accountIds, [...w]);
  }

  const totalSel = accountIds.length + webIds.length;
  const label =
    totalSel === 0
      ? "Pilih channel"
      : totalSel === 1
        ? (() => {
            const a = allAcc.find((x) => x.id === accountIds[0]);
            if (a) return `${a.username ? "@" + a.username : platformLabel(a.platform)}`;
            const wc = clients.find((c) => c.id === webIds[0]);
            return wc ? `${wc.name} · Web` : "1 channel";
          })()
        : `${totalSel} channel`;

  const Row = ({ on, onClick, icon, text, sub }: { on: boolean; onClick: () => void; icon: React.ReactNode; text: string; sub?: string }) => (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onClick}
      className={cn("flex min-h-11 w-full items-center gap-3 rounded-nav px-3 text-left text-small text-ink-800 hover:bg-paper-0", motion)}
    >
      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-lg border-control", on ? "border-brand-500 bg-brand-500 text-ink-800" : "border-ink-200 bg-paper-0")}>
        {on && <Check className="size-4" aria-hidden />}
      </span>
      {icon}
      <span className="flex-1 truncate">
        {text}
        {sub && <span className="text-ink-500"> · {sub}</span>}
      </span>
    </button>
  );

  return (
    <div className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={btnCls("secondary", "md", "gap-3")}>
        {totalSel > 1 && <Layers className="size-4" aria-hidden />}
        {label}
        <ChevronDown className={cn("size-4 text-ink-500 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-2 max-h-96 w-72 overflow-auto rounded-panel border border-hairline bg-paper-0 p-3 shadow-menu sm:w-80">
            <div className="flex items-center justify-between gap-3 pb-3">
              <p className={capsCls}>Pilih channel (social &amp; web)</p>
              <button
                type="button"
                onClick={() => {
                  setRefreshing(true);
                  router.refresh();
                  setTimeout(() => setRefreshing(false), 1200);
                }}
                className={btnCls("secondary", "xs", "gap-2")}
                title="Muat ulang daftar akun dari Zernio"
              >
                <RotateCw className={cn("size-4", refreshing && "animate-spin")} aria-hidden /> Refresh
              </button>
            </div>
            {clients.map((c) => (
              <div key={c.id} className="mb-2 rounded-field bg-paper-100 p-2 last:mb-0">
                <p className="px-3 pb-1 pt-2 font-title text-small font-bold text-ink-800">{c.name}</p>
                {c.accounts.length === 0 && <p className="px-3 pb-2 text-caption text-ink-500">Belum ada akun social. Klik Refresh.</p>}
                {c.accounts.map((a) => (
                  <Row
                    key={a.id}
                    on={accountIds.includes(a.id)}
                    onClick={() => toggleAcc(a.id)}
                    icon={platformIcon(a.platform)}
                    text={platformLabel(a.platform)}
                    sub={a.username ? `@${a.username}` : undefined}
                  />
                ))}
                <Row
                  on={webIds.includes(c.id)}
                  onClick={() => toggleWeb(c.id)}
                  icon={<Globe className="size-4 shrink-0 text-ink-500" aria-hidden />}
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
