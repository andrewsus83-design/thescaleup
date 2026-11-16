import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus, Store } from "lucide-react";
import { Card, Chip, EmptyState, PageHeader } from "@/components/brand/primitives";
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
      <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
        <PageHeader
          title="Choose a brand"
          description={user.isOwner ? "Every brand has its own team, tasks, keys and connections." : "Pick the brand you want to work on."}
          action={
            user.isOwner ? (
              <Link href="/hub/new" className={btnCls("primary", "md")}>
                <Plus className="size-4" aria-hidden />
                Add brand
              </Link>
            ) : undefined
          }
        />
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
                  <Card interactive>
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
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
