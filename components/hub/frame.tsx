import Link from "next/link";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Chip } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { signOut } from "@/lib/hub/actions";

/** Top bar for signed-in hub pages. */
export function HubBar({ email, isOwner, brandName }: { email: string; isOwner: boolean; brandName?: string }) {
  return (
    <header className="border-b border-ink-100 bg-paper-0">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/hub" aria-label="All brands" className="shrink-0">
            <Logo variant="lockup" size={24} />
          </Link>
          {brandName && <span className="truncate font-title text-body font-bold text-ink-800">/ {brandName}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {isOwner && <Chip tone="brand">Agency</Chip>}
          <span className="hidden max-w-[16rem] truncate text-small text-ink-500 sm:inline">{email}</span>
          <form action={signOut}>
            <button type="submit" className={btnCls("ghost", "sm")}>
              <LogOut className="size-4" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
