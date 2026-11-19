import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, KeyRound, Plus, Store } from "lucide-react";
import { Chip, EmptyState } from "@/components/brand/primitives";
import { HubSection } from "@/components/hub/all41-ui";
import { btnCls } from "@/components/brand/styles";
import { HubBar } from "@/components/hub/frame";
import { listMyBrands, requireHubUser } from "@/lib/hub/session";

export const metadata: Metadata = { title: "Your brands" };
export const dynamic = "force-dynamic";

export default async function HubHome() {
  const user = await requireHubUser("/hub");
  const brands = await listMyBrands();
  return (
    <>
      <HubBar email={user.email} isOwner={user.isOwner} />
      <main className="all41-shell all41-page w-full py-9 sm:py-12">
        <div className="all41-home-hero all41-surface mb-9 flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-9">
          <div className="min-w-0">
            <p className="all41-section-eyebrow mb-3">WELCOME TO ALL41</p>
            <h1 className="font-title text-h2 font-extrabold tracking-tight text-ink-800 sm:text-h1">Your workspaces</h1>
            <p className="mt-3 max-w-xl text-body text-ink-500">
              {user.isOwner
                ? "A thoughtful home for every business you manage. Choose a workspace to get things moving."
                : "Choose the business you want to work with today."}
            </p>
          </div>
          {user.isOwner && (
            <div className="flex flex-wrap gap-2">
              <Link href="/hub/settings" className={btnCls("secondary", "md")}>
                <KeyRound className="size-4" aria-hidden />
                Workspace keys
              </Link>
              <Link href="/hub/new" className={btnCls("primary", "md")}>
                <Plus className="size-4" aria-hidden />
                Add workspace
              </Link>
            </div>
          )}
        </div>
        <HubSection
          title="Choose a workspace"
          eyebrow="YOUR BUSINESSES"
          description="Your available workspaces appear here based on your access."
        >

        {brands.length === 0 ? (
          <EmptyState icon={<Store className="size-6" aria-hidden />} title="No brands yet" hint={user.isOwner ? "Add the first brand, then invite its founder." : "Ask the agency to invite you to your brand."}>
            {user.isOwner && (
              <Link href="/hub/new" className={btnCls("primary", "md")}>
                Add brand
              </Link>
            )}
          </EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {brands.map((b) => (
              <li key={b.id}>
                <Link href={`/hub/b/${b.slug}`} className="block">
                  <div className="all41-surface all41-module-card p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-title text-h3 text-ink-800">{b.name}</p>
                        <p className="mt-1 truncate font-mono text-micro text-ink-500">{b.slug}</p>
                      </div>
                      <ArrowRight className="mt-1 size-5 shrink-0 text-ink-500" aria-hidden />
                    </div>
                    {b.status !== "active" && (
                      <div className="mt-4">
                        <Chip tone="warn">{b.status}</Chip>
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        </HubSection>
      </main>
    </>
  );
}
