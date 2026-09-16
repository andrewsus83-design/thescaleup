"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

/** Re-fetch server data (e.g. newly-connected Zernio accounts like TikTok). */
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [spin, setSpin] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        setSpin(true);
        startTransition(() => router.refresh());
        setTimeout(() => setSpin(false), 1200);
      }}
      title="Muat ulang daftar akun (Instagram, TikTok, …) dari Zernio"
      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
    >
      <RotateCw className={`h-4 w-4 ${spin || pending ? "animate-spin" : ""}`} /> Refresh
    </button>
  );
}
