"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { btnCls } from "@/components/brand/styles";
import { cn } from "@/lib/utils";

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
      className={btnCls("secondary", "sm", "gap-2")}
    >
      <RotateCw className={cn("size-4", (spin || pending) && "animate-spin")} aria-hidden /> Refresh
    </button>
  );
}
