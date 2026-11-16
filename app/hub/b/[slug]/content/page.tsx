import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { ContentCalendar } from "@/components/hub/content/calendar";
import { ContentNav } from "@/components/hub/content/nav";
import { requireFunction } from "@/lib/hub/access";
import { listPlanned, listUnscheduled } from "@/lib/hub/content/data";
import { atLeast } from "@/lib/hub/permissions";
import { monthGrid, parseMonth } from "@/lib/hub/tasks/calendar";
import { hubTz, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Content" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ContentPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand, access } = await requireFunction(slug, "content");
  const canEdit = atLeast(access.content, "edit");
  const today = todayIn(hubTz());
  const month = parseMonth(one(sp.m), today);
  const grid = monthGrid(month);
  const [items, unscheduled] = await Promise.all([listPlanned(brand.id, grid[0][0].iso, grid[grid.length - 1][6].iso), listUnscheduled(brand.id)]);
  return (
    <>
      <PageHeader
        title="Content"
        description="Plan what goes out, write it with AI, and see it on one calendar."
        action={
          canEdit && (
            <Link href={`/hub/b/${slug}/content/new`} className={btnCls("primary", "md")}>
              New piece
            </Link>
          )
        }
      />
      <ContentNav slug={slug} active="calendar" canEdit={canEdit} />
      <ContentCalendar slug={slug} items={items} month={month} today={today} unscheduled={unscheduled} />
    </>
  );
}
