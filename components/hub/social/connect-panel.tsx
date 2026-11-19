"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Alert, Btn, Chip } from "@/components/brand/primitives";
import { motion } from "@/components/brand/styles";
import { cn } from "@/lib/utils";
import { disconnectAction, startConnectAction } from "@/lib/hub/social/connect-actions";
import { CONNECT_CHANNEL, CONNECT_PLATFORMS, platformLabel, type ConnectedAccount, type PlatformId } from "@/lib/hub/zernio/model";

const POLL_MS = 3_000; // while waiting, look again this often, in case the pop-up's message never arrives
const MAX_POLLS = 100; // about five minutes: the person has this long to finish in the pop-up

type Notice = { tone: "ok" | "bad"; text: string };
type Waiting = { platform: PlatformId; before: string[] };

/**
 * One switch per platform. Turning one on opens the platform's own approval screen in a pop-up and the account lands on this brand;
 * turning one off asks first, then removes this brand's accounts of that platform. The agency's Zernio key never reaches the browser.
 */
export function ConnectPanel({ brandId, accounts, ready, problem }: { brandId: string; accounts: ConnectedAccount[]; ready: boolean; problem: string | null }) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [busy, setBusy] = useState<PlatformId | null>(null);
  const [confirm, setConfirm] = useState<PlatformId | null>(null);
  const popup = useRef<Window | null>(null);
  const polls = useRef(0);

  const finish = useCallback(
    (n: Notice) => {
      setWaiting(null);
      setNotice(n);
      router.refresh();
    },
    [router],
  );

  // The pop-up's last page reports back here. Same-site only: a message from anywhere else is ignored.
  useEffect(() => {
    const onNote = (data: unknown) => {
      if (typeof data !== "object" || data === null || (data as { type?: unknown }).type !== CONNECT_CHANNEL) return;
      const d = data as { ok?: unknown; platform?: unknown; username?: unknown; message?: unknown };
      const what = typeof d.platform === "string" && d.platform ? platformLabel(d.platform) : "The account";
      if (d.ok === true) finish({ tone: "ok", text: `${what} connected${typeof d.username === "string" && d.username ? `: ${d.username.slice(0, 80)}` : ""}.` });
      else finish({ tone: "bad", text: typeof d.message === "string" && d.message ? d.message.slice(0, 200) : "The connection did not finish. Try again." });
    };
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CONNECT_CHANNEL);
      channel.onmessage = (e) => onNote(e.data);
    } catch {
      /* an older browser: the window message below still works when the platform kept the opener */
    }
    const onWindow = (e: MessageEvent) => {
      if (e.origin === window.location.origin) onNote(e.data);
    };
    window.addEventListener("message", onWindow);
    return () => {
      channel?.close();
      window.removeEventListener("message", onWindow);
    };
  }, [finish]);

  // While waiting, look at the server now and then. A new account of that platform means it worked, even if no message came.
  useEffect(() => {
    if (!waiting) return;
    polls.current = 0;
    const t = window.setInterval(() => {
      polls.current += 1;
      if (polls.current > MAX_POLLS) {
        setWaiting(null);
        setNotice({ tone: "bad", text: "Still nothing after five minutes. Turn the switch on again to retry." });
        return;
      }
      router.refresh();
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [waiting, router]);

  // The refreshed list has an account the page did not have when the pop-up opened: that connection worked.
  if (waiting && accounts.some((a) => a.platform === waiting.platform && !waiting.before.includes(a.id))) {
    setWaiting(null);
    setNotice({ tone: "ok", text: `${platformLabel(waiting.platform)} connected.` });
  }

  async function turnOn(platform: PlatformId) {
    setNotice(null);
    // The window opens in the click itself, before any waiting, or the browser blocks it. The address is filled in a moment later.
    const w = window.open("about:blank", "scaleup-connect", `popup=yes,width=520,height=720,left=${Math.max(0, Math.round(window.screenX + (window.outerWidth - 520) / 2))},top=${Math.max(0, Math.round(window.screenY + 60))}`);
    if (!w) {
      setNotice({ tone: "bad", text: "Your browser blocked the pop-up. Allow pop-ups for this site, then try again." });
      return;
    }
    popup.current = w;
    setBusy(platform);
    const r = await startConnectAction(brandId, platform);
    setBusy(null);
    if (!r.ok) {
      w.close();
      setNotice({ tone: "bad", text: r.error });
      return;
    }
    w.location.href = r.authUrl;
    setWaiting({ platform, before: accounts.filter((a) => a.platform === platform).map((a) => a.id) });
  }

  async function turnOff(platform: PlatformId, accountId?: string) {
    setNotice(null);
    setBusy(platform);
    const r = await disconnectAction(brandId, platform, accountId);
    setBusy(null);
    setConfirm(null);
    setNotice(r.ok ? { tone: "ok", text: r.removed > 0 ? `${platformLabel(platform)} disconnected.` : `${platformLabel(platform)} had nothing to disconnect.` } : { tone: "bad", text: r.error });
    router.refresh();
  }

  function stopWaiting() {
    setWaiting(null);
    try {
      popup.current?.close();
    } catch {
      /* already closed, or the platform took the window over */
    }
    router.refresh();
  }

  const locked = !ready || busy !== null || waiting !== null;
  return (
    <div>
      {problem && (
        <Alert tone="warn" role="alert" className="mb-4">
          {problem}
        </Alert>
      )}
      <div aria-live="polite">
        {notice && (
          <Alert tone={notice.tone} role={notice.tone === "bad" ? "alert" : "status"} className="mb-4">
            {notice.text}
          </Alert>
        )}
        {waiting && (
          <Alert tone="info" className="mb-4">
            <span className="inline-flex flex-wrap items-center gap-3">
              Waiting for you to finish {platformLabel(waiting.platform)} in the pop-up window.
              <Btn type="button" variant="ghost" size="xs" onClick={stopWaiting}>
                Stop waiting
              </Btn>
            </span>
          </Alert>
        )}
      </div>

      <ul className="divide-y divide-ink-100">
        {CONNECT_PLATFORMS.map(({ id, label }) => {
          const mine = accounts.filter((a) => a.platform === id);
          const on = mine.length > 0;
          const working = busy === id || waiting?.platform === id;
          return (
            <li key={id} className="py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p id={`conn-${id}`} className="text-body font-semibold text-ink-800">
                    {label}
                  </p>
                  {!on && <p className="text-small text-ink-500">{ready ? "Not connected" : "Waiting for the agency's Zernio key"}</p>}
                </div>
                <div className="flex items-center gap-3">
                  {working && <Loader2 className="size-4 animate-spin text-ink-500" aria-label="Working" />}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-labelledby={`conn-${id}`}
                    disabled={locked}
                    onClick={() => (on ? setConfirm(id) : void turnOn(id))}
                    className={cn("hit-44 flex h-11 items-center rounded-full disabled:opacity-50", motion)}
                  >
                    <span aria-hidden className={cn("relative h-6 w-11 shrink-0 rounded-full", motion, on ? "bg-brand-500" : "bg-ink-200")}>
                      <span className={cn("absolute left-0.5 top-0.5 size-5 rounded-full bg-paper-0 shadow-sm transition-transform duration-150 ease-out", on && "translate-x-5")} />
                    </span>
                  </button>
                </div>
              </div>

              {on && (
                <ul className="mt-2 space-y-2">
                  {mine.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2 text-small text-ink-700">
                      <span className="font-medium text-ink-800">{a.username || a.name || "Account"}</span>
                      {a.name && a.username && a.name !== a.username && <span className="text-ink-500">{a.name}</span>}
                      {a.needsReconnect && <Chip tone="warn">Needs reconnecting</Chip>}
                      {a.needsReconnect && (
                        <Btn type="button" variant="ghost" size="xs" disabled={locked} onClick={() => void turnOn(id)}>
                          Reconnect
                        </Btn>
                      )}
                      {mine.length > 1 && (
                        <Btn type="button" variant="ghost" size="xs" disabled={locked} onClick={() => void turnOff(id, a.id)}>
                          Disconnect
                        </Btn>
                      )}
                    </li>
                  ))}
                  <li>
                    <Btn type="button" variant="ghost" size="xs" disabled={locked} onClick={() => void turnOn(id)}>
                      Add another {label} account
                    </Btn>
                  </li>
                </ul>
              )}

              {confirm === id && (
                <Alert tone="warn" role="alert" className="mt-3">
                  <p>
                    Disconnect {mine.length === 1 ? "this" : `all ${mine.length}`} {label} account{mine.length === 1 ? "" : "s"} from this brand? Social media, Inbox and Ads stop showing {mine.length === 1 ? "it" : "them"}. You can connect again any time.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn type="button" variant="danger" size="sm" disabled={busy !== null} onClick={() => void turnOff(id)}>
                      Disconnect
                    </Btn>
                    <Btn type="button" variant="secondary" size="sm" onClick={() => setConfirm(null)}>
                      Keep it
                    </Btn>
                  </div>
                </Alert>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
