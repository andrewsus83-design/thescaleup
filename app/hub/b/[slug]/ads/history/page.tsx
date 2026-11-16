import type { Metadata } from "next";
import { History } from "lucide-react";
import { Alert, EmptyState, PageHeader } from "@/components/brand/primitives";
import { AdList, AdsNav, FilterBar, ProblemNotice, TotalsStrip, adsBase } from "@/components/hub/ads/parts";
import { requireFunction } from "@/lib/hub/access";
import { delivered, filterAds, isLive, noNumbers, parseFilters, parseRange, totals } from "@/lib/hub/ads/model";
import { loadAds } from "@/lib/hub/ads/zernio";
import { canManageTeam } from "@/lib/hub/rules";
import { hubTz, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Ads history" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdsHistoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand, actor } = await requireFunction(slug, "ads");
  const get = (k: string) => one(sp[k]) ?? "";
  const tz = hubTz();
  const today = todayIn(tz);
  const range = parseRange(get, today);
  const filters = parseFilters(get, "newest");
  const res = await loadAds(brand.id, range.from, range.to);

  return (
    <>
      <PageHeader title="Ads" description="What is running, what it cost and what to do next. Read from Zernio; nothing here spends money or changes an ad." />
      <AdsNav slug={slug} active="history" range={range} platform={filters.platform} />
      {!res.ok ? (
        <ProblemNotice slug={slug} problem={res.problem} canSetup={canManageTeam(actor)} />
      ) : (
        (() => {
          // History: ads that are no longer running and that delivered something in the days picked.
          const past = res.ads.filter((a) => !isLive(a.status) && delivered(a));
          const rows = filterAds(past, filters);
          return (
            <>
              {res.backfill && (
                <Alert tone="info" className="mb-4">
                  Zernio is still importing this ad account&apos;s history. Reload in a few minutes to see all of it.
                </Alert>
              )}
              {res.more && (
                <Alert tone="warn" className="mb-4">
                  Only the first 200 ads are read. Narrow the days or pick a platform to see the rest.
                </Alert>
              )}
              {noNumbers(res.ads) && (
                <Alert tone="warn" className="mb-4">
                  Zernio sent these ads without spend or click numbers this app recognises, so they show as dashes.
                </Alert>
              )}
              <FilterBar base={`${adsBase(slug)}/history`} range={range} filters={filters} platforms={[...new Set(past.map((a) => a.platform))].sort()} today={today} full />
              <p className="mb-3 text-small text-ink-500">Paused, ended and rejected ads that delivered in the days you picked.</p>
              {rows.length === 0 ? (
                <EmptyState icon={<History className="size-6" aria-hidden />} title={past.length === 0 ? "Nothing in this period" : "No ads match the filters"} hint={past.length === 0 ? "Pick more days. Zernio keeps up to two years, and ad accounts import their last 90 days when connected." : "Change the spend limits or the platform."} />
              ) : (
                <>
                  <TotalsStrip totals={totals(rows)} />
                  <AdList ads={rows} tz={tz} />
                </>
              )}
            </>
          );
        })()
      )}
    </>
  );
}
