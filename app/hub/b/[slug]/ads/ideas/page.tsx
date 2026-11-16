import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Alert, Chip, EmptyState, PageHeader } from "@/components/brand/primitives";
import { AdsNav, FilterBar, ProblemNotice, adsBase } from "@/components/hub/ads/parts";
import { requireFunction } from "@/lib/hub/access";
import { boostCandidates, parseFilters, parseRange, platformLabel, suggest, type PostRow } from "@/lib/hub/ads/model";
import { loadAds, loadPosts } from "@/lib/hub/ads/zernio";
import { listPlanned, type ContentCard } from "@/lib/hub/content/data";
import { CHANNEL_LABEL, KIND_LABEL, type Channel } from "@/lib/hub/content/model";
import { canManageTeam } from "@/lib/hub/rules";
import { addDays, dayIn, fmtDay, hubTz, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Ads suggestions" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const SOCIAL: readonly Channel[] = ["instagram", "facebook", "tiktok", "linkedin", "x", "youtube"];

function Heading({ id, children, note }: { id: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-3">
      <h2 id={id} className="font-title text-h4 text-ink-800">
        {children}
      </h2>
      {note && <p className="mt-1 text-small text-ink-500">{note}</p>}
    </div>
  );
}

function PostList({ posts, tz }: { posts: PostRow[]; tz: string }) {
  return (
    <ul className="space-y-3">
      {posts.map((p) => (
        <li key={p.id} className="rounded-field bg-paper-0 p-5 shadow-raised">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-ink-500">
            {p.platform && <span className="font-semibold text-ink-800">{platformLabel(p.platform)}</span>}
            {p.at && !Number.isNaN(Date.parse(p.at)) && <span>{fmtDay(dayIn(tz, p.at))}</span>}
            <span>{p.interactions.toLocaleString("en-US")} likes, comments, shares and saves</span>
            {p.reach !== null && <span>{p.reach.toLocaleString("en-US")} reached</span>}
          </div>
          <p className="mt-2 text-body text-ink-800">{p.text || "(no caption)"}</p>
          {p.url && (
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-small font-semibold text-brand-700 underline underline-offset-4">
              Open the post
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function ContentList({ slug, items }: { slug: string; items: ContentCard[] }) {
  return (
    <ul className="space-y-2">
      {items.map((c) => (
        <li key={c.id}>
          <Link href={`/hub/b/${slug}/content/${c.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-field bg-paper-0 px-5 py-4 shadow-raised hover:bg-paper-100 focus-visible:shadow-focus focus-visible:outline-none">
            <span className="text-body font-semibold text-ink-800">{c.title}</span>
            <Chip>{KIND_LABEL[c.kind]}</Chip>
            {c.channel && <Chip>{CHANNEL_LABEL[c.channel]}</Chip>}
            {c.scheduled_for && <span className="text-small text-ink-500">{fmtDay(c.scheduled_for)}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function AdsIdeasPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand, actor, access } = await requireFunction(slug, "ads");
  const get = (k: string) => one(sp[k]) ?? "";
  const tz = hubTz();
  const today = todayIn(tz);
  const range = parseRange(get, today);
  const filters = parseFilters(get, "spend");
  const canContent = access.content !== "none";

  const [res, posts, planned] = await Promise.all([loadAds(brand.id, range.from, range.to), loadPosts(brand.id, range.from, range.to), canContent ? listPlanned(brand.id, addDays(today, -30), addDays(today, 14)) : Promise.resolve([] as ContentCard[])]);

  // From the Content calendar: ad copy that is approved, social pieces posted lately, and approved ones coming up.
  const social = (c: ContentCard) => c.channel !== null && SOCIAL.includes(c.channel);
  const adCopy = planned.filter((c) => c.kind === "ad" && c.status === "approved");
  const recent = planned.filter((c) => c.status === "posted" && social(c) && c.kind !== "ad" && (c.scheduled_for ?? "") <= today);
  const coming = planned.filter((c) => c.status === "approved" && social(c) && c.kind !== "ad" && (c.scheduled_for ?? "") > today);

  const adsOk = res.ok ? res.ads : [];
  const tips = suggest(adsOk.filter((a) => !filters.platform || a.platform === filters.platform));
  const boost = posts ? boostCandidates(filters.platform ? posts.filter((p) => p.platform === filters.platform || (filters.platform === "facebook" && p.platform === "instagram")) : posts, adsOk) : [];

  return (
    <>
      <PageHeader title="Ads" description="What is running, what it cost and what to do next. Read from Zernio; nothing here spends money or changes an ad." />
      <AdsNav slug={slug} active="ideas" range={range} platform={filters.platform} />
      <FilterBar base={`${adsBase(slug)}/ideas`} range={range} filters={filters} platforms={[...new Set(adsOk.map((a) => a.platform))].sort()} today={today} full={false} />

      <div className="space-y-10">
        <section aria-labelledby="ads-tips">
          <Heading id="ads-tips" note="Plain rules over the numbers. Each one says what it rests on. Nothing changes until someone does it in the ad account.">
            On your ads
          </Heading>
          {!res.ok ? (
            <ProblemNotice slug={slug} problem={res.problem} canSetup={canManageTeam(actor)} />
          ) : tips.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="size-6" aria-hidden />} title="Nothing needs attention" hint="No rejected ads, no running ad with many views and no clicks, and no big gap in cost per click. Pick more days for a wider look." />
          ) : (
            <ul className="space-y-3">
              {tips.map((t) => (
                <li key={t.id} className="rounded-field bg-paper-0 p-5 shadow-raised">
                  <div className="flex flex-wrap items-center gap-3">
                    <Chip tone={t.tone}>{t.title}</Chip>
                    <span className="text-small text-ink-500">{platformLabel(t.platform)}</span>
                  </div>
                  <p className="mt-2 break-words text-body font-semibold text-ink-800">{t.adName}</p>
                  <p className="mt-1 text-small text-ink-800">{t.why}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="ads-posts">
          <Heading id="ads-posts" note="The best-liked posts in the days you picked that no ad promotes yet. Ranked by likes, comments, shares and saves.">
            Posts worth boosting
          </Heading>
          {posts === null ? (
            <Alert tone="warn">The posts could not be read from Zernio, so none are suggested. This is not the same as having none.</Alert>
          ) : boost.length === 0 ? (
            <EmptyState title="No post stands out" hint="Posts with no likes or comments, or ones an ad already promotes, are left out." />
          ) : (
            <PostList posts={boost} tz={tz} />
          )}
        </section>

        {canContent && (
          <section aria-labelledby="ads-content">
            <Heading id="ads-content" note="From your Content calendar. These are not ranked by results: they are pieces that are ready, or went out lately.">
              Content that can be ads
            </Heading>
            {adCopy.length + recent.length + coming.length === 0 ? (
              <EmptyState title="Nothing in the calendar yet" hint="Approved ad copy, and social posts that are approved or posted, show up here from 30 days back to 2 weeks ahead." />
            ) : (
              <div className="space-y-6">
                {adCopy.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-small font-semibold text-ink-800">Ad copy that is approved</h3>
                    <ContentList slug={slug} items={adCopy} />
                  </div>
                )}
                {coming.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-small font-semibold text-ink-800">Going out soon: plan the boost for the day it posts</h3>
                    <ContentList slug={slug} items={coming} />
                  </div>
                )}
                {recent.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-small font-semibold text-ink-800">Posted in the last 30 days</h3>
                    <ContentList slug={slug} items={recent} />
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
