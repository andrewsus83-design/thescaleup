"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Btn, Chip } from "@/components/brand/primitives";
import { myTelegramCode, unlinkMyTelegram } from "@/lib/hub/telegram-actions";

/** Links the signed-in person's own Telegram to their login with a one-time code, or unlinks it. Open to everyone on the team. */
export function MyTelegram({ brandId, linked: startLinked }: { brandId: string; linked: boolean }) {
  const [linked, setLinked] = useState(startLinked);
  const [code, setCode] = useState<{ code: string; minutes: number; bot: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function get() {
    setBusy("code");
    setError("");
    const r = await myTelegramCode(brandId);
    setBusy("");
    if (r.ok) setCode({ code: r.code, minutes: r.minutes, bot: r.bot });
    else setError(r.error);
  }
  async function unlink() {
    setBusy("unlink");
    setError("");
    const r = await unlinkMyTelegram(brandId);
    setBusy("");
    if (r.ok) {
      setLinked(false);
      setCode(null);
    } else setError(r.error);
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert tone="bad" role="alert">
          {error}
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Chip tone={linked ? "ok" : "neutral"}>{linked ? "Linked" : "Not linked"}</Chip>
        <Btn variant={linked ? "secondary" : "primary"} onClick={get} disabled={busy !== ""}>
          {busy === "code" && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {linked ? "Link a different Telegram" : "Link my Telegram"}
        </Btn>
        {linked && (
          <Btn onClick={unlink} disabled={busy !== ""}>
            {busy === "unlink" && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Unlink
          </Btn>
        )}
      </div>
      {code && (
        <div className="space-y-3 rounded-xl border border-ink-100 p-4">
          <p className="text-small text-ink-600">
            Open <strong>@{code.bot}</strong> in Telegram and send it this code, in a private chat (not a group). It works once and expires in {code.minutes} minutes.
          </p>
          <p aria-label={`Your code is ${code.code.split("").join(" ")}`} className="font-mono text-h3 tracking-widest text-ink-800">
            {code.code}
          </p>
          <a href={`https://t.me/${code.bot}?start=${code.code}`} target="_blank" rel="noopener noreferrer" className="hit-44 inline-flex min-h-11 items-center rounded-full bg-ink-800 px-5 text-button font-semibold text-paper-100 hover:bg-ink-700">
            Open Telegram with the code filled in
          </a>
          <p className="text-caption text-ink-500">The bot will say &ldquo;Linked&rdquo;. After that send it /help to see what it can do.</p>
        </div>
      )}
      {!code && !linked && <p className="text-small text-ink-500">Link your Telegram to ask the bot for your tasks, add one, or mark one done, from your phone. It does everything as you, with your role.</p>}
    </div>
  );
}
