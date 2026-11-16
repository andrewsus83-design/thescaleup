import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, Chip, PageHeader } from "@/components/brand/primitives";
import { BackToCalendar, DeleteItem, ItemForm } from "@/components/hub/content/forms";
import { requireFunction } from "@/lib/hub/access";
import { getItem } from "@/lib/hub/content/data";
import { CHANNEL_LABEL, KIND_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/hub/content/model";
import { atLeast } from "@/lib/hub/permissions";
import { fmtDay, isIsoDate } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Content piece" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ItemPage({ params }: { params: Promise<{ slug: string; itemId: string }> }) {
  const { slug, itemId } = await params;
  const { brand, access } = await requireFunction(slug, "content");
  if (!UUID.test(itemId)) notFound();
  const item = await getItem(brand.id, itemId);
  if (!item) notFound();
  const canEdit = atLeast(access.content, "edit");
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title={item.title} action={<BackToCalendar slug={slug} />} />
      {item.source === "ai" && item.status === "draft" && canEdit && <Alert tone="info">Written by AI from your brief. Check the facts before it goes out.</Alert>}
      {canEdit ? (
        <>
          <div className="mt-4">
            <ItemForm brandId={brand.id} item={item} />
          </div>
          <DeleteItem brandId={brand.id} id={item.id} title={item.title} />
        </>
      ) : (
        <article className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Chip>
            <Chip>{KIND_LABEL[item.kind]}</Chip>
            {item.channel && <Chip>{CHANNEL_LABEL[item.channel]}</Chip>}
            {item.scheduled_for && isIsoDate(item.scheduled_for) && <span className="text-small text-ink-500">{fmtDay(item.scheduled_for)}</span>}
          </div>
          <p className="mt-4 whitespace-pre-wrap text-body text-ink-800">{item.body || "No text yet."}</p>
        </article>
      )}
    </div>
  );
}
