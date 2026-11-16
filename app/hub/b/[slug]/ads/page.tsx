import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { Alert, EmptyState, PageHeader } from "@/components/brand/primitives";
import { AdList, AdsNav, FilterBar, ProblemNotice, TotalsStrip, adsBase } from "@/components/hub/ads/parts";
import { requireFunction } from "@/lib/hub/access";
import { filterAds, isLive, noNumbers, parseFilters, parseRange, totals } from "@/lib/hub/ads/model";
import { loadAds } from "@/lib/hub/ads/zernio";
import { canManageTeam } from "@/lib/hub/rules";
import { hubTz, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Ads" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand, actor } = await requireFunction(slug, "ads");
  const get = (k: string) => one(sp[k]) ?? "";
  const tz = hubTz();
  const today = todayIn(tz);
  const range = parseRange(get, today);
  const filters = parseFilters(get, "spend");
  const res = await loadAds(brand.id, range.from, range.to);
  const base = adsBase(slug);

  return (
    <>
      <PageHeader title="Ads" description="What is running, what it cost and what to do next. Read from Zernio; nothing here spends money or changes an ad." />
      <AdsNav slug={slug} active="active" range={range} platform={filters.platform} />
      {!res.ok ? (
        <ProblemNotice slug={slug} problem={res.problem} canSetup={canManageTeam(actor)} />
      ) : (
        <Body slug={slug} base={base} res={res} range={range} filters={filters} tz={tz} today={today} />
      )}
    </>
  );
}

function Body({ base, res, range, filters, tz, today }: { slug: string; base: string; res: Extract<Awaited<ReturnType<typeof loadAds>>, { ok: true }>; range: ReturnType<typeof parseRange>; filters: ReturnType<typeof parseFilters>; tz: string; today: string }) {
  const live = res.ads.filter((a) => isLive(a.status));
  const platforms = [...new Set(live.map((a) => a.platform))].sort();
  const rows = filterAds(live, filters);
  return (
    <>
      {res.backfill && (
        <Alert tone="info" className="mb-4">
          Zernio is still importing this ad account&apos;s history. Numbers fill in over the next minutes; reload to see them.
        </Alert>
      )}
      {res.more && (
        <Alert tone="warn" className="mb-4">
          Only the first 200 ads are shown. Narrow the days or pick a platform to see the rest.
        </Alert>
      )}
      {noNumbers(res.ads) && (
        <Alert tone="warn" className="mb-4">
          Zernio sent these ads without spend or click numbers this app recognises, so they show as dashes. The ads themselves are real.
        </Alert>
      )}
      <FilterBar base={base} range={range} filters={filters} platforms={platforms} today={today} full />
      <p className="mb-3 text-small text-ink-500">Running, in review and scheduled ads. Numbers cover the days you picked.</p>
      {rows.length === 0 ? (
        <EmptyState icon={<Megaphone className="size-6" aria-hidden />} title={live.length === 0 ? "No ads are running" : "No ads match the filters"} hint={live.length === 0 ? "Ads that are running, in review or scheduled show up here. Finished and paused ones are in History." : "Change the spend limits or the platform."} />
      ) : (
        <>
          <TotalsStrip totals={totals(rows)} />
          <AdList ads={rows} tz={tz} />
        </>
      )}
    </>
  );
}
