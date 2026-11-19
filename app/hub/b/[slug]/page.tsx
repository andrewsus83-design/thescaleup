import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck, ChevronRight, CircleCheck } from "lucide-react";
import { HubSection, HubSurface } from "@/components/hub/all41-ui";
import { btnCls } from "@/components/brand/styles";
import { MENU } from "@/components/hub/menus";
import { accessFor } from "@/lib/hub/access";
import { countDue } from "@/lib/hub/crm/data";
import { buildSignals, dueSummary, greeting, hourIn, tileNote } from "@/lib/hub/home";
import { countUnread } from "@/lib/hub/mail/data";
import { catalogTotals } from "@/lib/hub/products/model";
import { loadCatalog } from "@/lib/hub/products/data";
import { requireBrand } from "@/lib/hub/session";
import { visibleTabs } from "@/lib/hub/tabs";
import { hubTz, todayIn } from "@/lib/hub/tasks/dates";
import { listTasks } from "@/lib/hub/tasks/data";

export const metadata: Metadata = { title: "Home" };
export const dynamic = "force-dynamic";

// Secondary text on a coloured tint: Ink-500 is a little too light on some tints, so it is a shade darker here.

/** Home: a greeting, what needs the person today, and every menu they can open. Only counts they are allowed to see are looked up. */
export default async function BrandHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, brand, actor } = await requireBrand(slug);
  const access = await accessFor(brand.id, actor);
  const tz = hubTz();
  const today = todayIn(tz);
  const base = `/hub/b/${brand.slug}`;

  // A failed lookup becomes null (nothing said) instead of breaking Home.
  const [tasks, unread, stock, followUps] = await Promise.all([
    access.tasks !== "none"
      ? listTasks(brand.id, actor, { userId: user.id, assignee: "me", dueTo: today, limit: 200 }).then((r) => dueSummary(r, today)).catch(() => null)
      : null,
    access.mail !== "none" ? countUnread(brand.id).catch(() => null) : null,
    access.products !== "none"
      ? loadCatalog(brand.id).then((c) => {
          const t = catalogTotals(c.items);
          return { low: t.low, out: t.out };
        }).catch(() => null)
      : null,
    access.crm !== "none" ? countDue(brand.id, today).catch(() => null) : null,
  ]);
  const counts = { tasks, unread, stock, followUps };
  const signals = buildSignals(base, counts);
  const watching = tasks !== null || unread !== null || stock !== null || followUps !== null;
  const menus = visibleTabs(access).filter((k) => k !== "home");
  const dateLine = new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date());

  return (
    <div className="space-y-9 sm:space-y-11">
      <header className="all41-home-hero all41-surface relative overflow-hidden px-6 py-7 sm:px-9 sm:py-9">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="all41-section-eyebrow mb-3">YOUR WORKSPACE AT A GLANCE</p>
            <h1 className="font-title text-balance text-h2 font-extrabold tracking-tight text-ink-800 sm:text-h1">
              {greeting(hourIn(tz))}
            </h1>
            <p className="mt-3 text-body text-ink-500">
              A good day starts with <span className="all41-editorial">a little clarity.</span>
            </p>
            <p className="mt-2 text-caption text-ink-500">{dateLine}</p>
          </div>
          <Link href={`${base}/today`} className={btnCls("primary", "md")}>
            <CalendarCheck className="size-4" aria-hidden />
            Plan my day
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </header>

      {watching && (
        <HubSection
          id="needs-you"
          eyebrow="YOUR NEXT ACTIONS"
          title="Needs your attention"
          description="A practical starting point for today's work. Only information you're allowed to see appears here."
        >
          {signals.length === 0 ? (
            <HubSurface className="flex items-center gap-4">
              <span aria-hidden className="all41-module-icon inline-flex size-12 shrink-0 items-center justify-center rounded-field">
                <CircleCheck className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="font-title text-body font-bold text-ink-800">You're all caught up</p>
                <p className="mt-1 text-small text-ink-500">No overdue tasks, unread mail, follow-ups or stock alerts currently require your attention.</p>
              </div>
            </HubSurface>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {signals.map((signal) => {
                const Icon = MENU[signal.menu].icon;
                return (
                  <li key={signal.key} className="min-w-0">
                    <Link
                      href={signal.href}
                      data-acc={signal.menu}
                      className="all41-surface all41-module-card hit-44 flex h-full min-h-24 items-center gap-4 p-4 sm:p-5"
                    >
                      <span aria-hidden className="all41-module-icon inline-flex size-12 shrink-0 items-center justify-center rounded-field">
                        <Icon className="size-6" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-title text-body font-bold text-ink-800">{signal.title}</span>
                        {signal.detail && <span className="mt-1 block text-small text-ink-500">{signal.detail}</span>}
                      </span>
                      <ChevronRight className="size-5 shrink-0 text-ink-500" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </HubSection>
      )}

      <HubSection
        id="your-menus"
        eyebrow="ONE CONNECTED WORKSPACE"
        title="Everything, in its place."
        description="Open a module to keep work moving. Your available tools are based on your permissions."
      >
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {menus.map((menu) => {
            const { label, icon: Icon } = MENU[menu];
            const note = tileNote(menu, counts);
            return (
              <li key={menu} className="min-w-0">
                <Link
                  href={`${base}/${menu}`}
                  data-acc={menu}
                  className="all41-surface all41-module-card hit-44 group flex h-full min-h-40 flex-col justify-between gap-5 p-4 sm:p-5"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span aria-hidden className="all41-module-icon inline-flex size-12 items-center justify-center rounded-field">
                      <Icon className="size-6" />
                    </span>
                    <ArrowRight className="size-4 text-ink-400 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-title text-body font-extrabold text-ink-800">{label}</span>
                    {note && <span className="mt-1 block text-caption text-ink-500">{note}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </HubSection>
    </div>
  );
}
