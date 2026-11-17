import Link from "next/link";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Chip } from "@/components/brand/primitives";
import { signOut } from "@/lib/hub/actions";

const roundBtn =
  "hit-44 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-paper-0 text-ink-800 shadow-raised transition-colors hover:bg-paper-50 active:bg-paper-200 motion-reduce:transition-none";

/** Top bar for signed-in hub pages: the brand as a pill (tap to switch brand), then the account and sign-out circles. */
export function HubBar({ email, isOwner, brandName }: { email: string; isOwner: boolean; brandName?: string }) {
  return (
    <header>
      <div className="mx-auto flex h-20 w-full max-w-5xl items-center justify-between gap-3 px-6 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {/* With a brand open the pill is the way back to all brands; the lockup would only repeat it on a phone. */}
          <Link href="/hub" aria-label="All brands" className={brandName ? "hidden shrink-0 lg:block" : "shrink-0"}>
            <Logo variant="lockup" size={24} />
          </Link>
          {brandName && (
            <Link
              href="/hub"
              title="Switch brand"
              className="hit-44 inline-flex h-11 min-w-0 items-center gap-2 rounded-full bg-paper-0 px-5 font-title text-button font-bold text-ink-800 shadow-raised transition-colors hover:bg-paper-50 active:bg-paper-200 motion-reduce:transition-none"
            >
              <span className="truncate">{brandName}</span>
              <ChevronDown className="size-4 shrink-0 text-ink-500" aria-hidden />
            </Link>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {isOwner && <Chip tone="brand" className="hidden sm:inline-flex">Agency</Chip>}
          <Link href="/hub/account" aria-label={`Account (${email})`} title={email} className={roundBtn}>
            <UserRound className="size-5" aria-hidden />
          </Link>
          <form action={signOut}>
            <button type="submit" aria-label="Sign out" title="Sign out" className={roundBtn}>
              <LogOut className="size-5" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
