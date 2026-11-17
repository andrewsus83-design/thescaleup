import type { Metadata } from "next";
import { Share2 } from "lucide-react";
import { Alert, EmptyState, PageHeader } from "@/components/brand/primitives";
import { DayChart, Notes, PlatformTable, ProblemNotice, RangeBar, TopPosts, TotalsStrip, socialBase } from "@/components/hub/social/parts";
import { requireFunction } from "@/lib/hub/access";
import { parseRange, platformLabel } from "@/lib/hub/ads/model";
import { clampWindow, notes } from "@/lib/hub/social/model";
import { loadSocial } from "@/lib/hub/social/zernio";
import { canManageTeam } from "@/lib/hub/rules";
import { hubTz, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Social Media" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SocialPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand, actor } = await requireFunction(slug, "social");
  const get = (k: string) => one(sp[k]) ?? "";
  const tz = hubTz();
  const today = todayIn(tz);
  const parsed = parseRange(get, today);
  const win = clampWindow({ from: parsed.from, to: parsed.to });
  const range = { ...parsed, ...win };
  const platform = /^[a-z0-9_]{2,30}$/.test(get("p")) ? get("p") : undefined;
  const res = await loadSocial(brand.id, win, platform);
  const base = socialBase(slug);

  return (
    <>
      <PageHeader title="Social Media" description="Reach, posts and interactions across the brand's connected accounts, against the days before. Read from Zernio; nothing here posts or changes anything." />
      {!res.ok ? (
        <ProblemNotice slug={slug} problem={res.problem} canSetup={canManageTeam(actor)} />
      ) : (
        <>
          {parsed.from !== win.from && (
            <Alert tone="info" className="mb-4">
              Zernio reads at most 366 days at a time, so this starts on {win.from}.
            </Alert>
          )}
          <RangeBar base={base} range={range} platform={platform} platforms={[...new Set([...res.cur.platforms.map((p) => p.platform), ...(platform ? [platform] : [])])].sort()} today={today} />
          {res.cur.totals.postCount === 0 && res.cur.days.length === 0 ? (
            <EmptyState icon={<Share2 className="size-6" aria-hidden />} title="Nothing posted in these days" hint="Pick a longer range, or check in Zernio that the accounts are connected and have finished syncing." />
          ) : (
            <>
              <TotalsStrip cur={res.cur} prev={res.prev} />
              <DayChart cur={res.cur} window={win} />
              <Notes notes={notes(res.cur, res.prev, win, platformLabel)} />
              <PlatformTable cur={res.cur} />
              {res.posts && <TopPosts posts={res.posts} tz={tz} />}
              <p className="text-caption text-ink-500">Reach adds up each post&apos;s reach, so one person who saw two posts counts twice. Numbers come from the platforms through Zernio and can lag by up to a day.</p>
            </>
          )}
        </>
      )}
    </>
  );
}
