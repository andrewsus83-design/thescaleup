import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/brand/primitives";

/**
 * Wrapper for one Settings section. On a laptop the way back, the title and what the section is for sit in a column on the left and
 * stay in view; the forms take the wider column on the right, so a line of text stays readable. On a phone they stack.
 */
export function SettingsShell({ slug, title, description, back, children }: { slug: string; title: string; description?: string; back?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-3">
      <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
      <Link href={back?.href ?? `/hub/b/${slug}/settings`} className="mb-6 inline-flex min-h-11 items-center gap-2 text-small font-semibold text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        {back?.label ?? "Settings"}
      </Link>
      <PageHeader title={title} description={description} />
      </div>
      <div className="min-w-0 space-y-8 lg:col-span-2">{children}</div>
    </div>
  );
}
