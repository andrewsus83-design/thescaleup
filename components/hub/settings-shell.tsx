import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/brand/primitives";

/** Wrapper for one Settings section: a way back to the list, a title, and a readable column. */
export function SettingsShell({ slug, title, description, children }: { slug: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link href={`/hub/b/${slug}/settings`} className="mb-6 inline-flex min-h-11 items-center gap-2 text-small font-semibold text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Settings
      </Link>
      <PageHeader title={title} description={description} />
      <div className="space-y-8">{children}</div>
    </div>
  );
}
