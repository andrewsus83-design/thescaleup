import type { Metadata } from "next";
import { PageHeader } from "@/components/brand/primitives";
import { BackToCalendar, ItemForm } from "@/components/hub/content/forms";
import { requireFunction } from "@/lib/hub/access";
import { isIsoDate } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "New piece" };
export const dynamic = "force-dynamic";

export default async function NewItemPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ day?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand } = await requireFunction(slug, "content", "edit");
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="New piece" action={<BackToCalendar slug={slug} />} />
      <ItemForm brandId={brand.id} day={isIsoDate(sp.day) ? sp.day : undefined} />
    </div>
  );
}
