import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, CircleCheck } from "lucide-react";
import { MENU } from "@/components/hub/menus";
import { accessFor } from "@/lib/hub/access";
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
const SUB = "text-[#4d4a45]";

/** Home: a greeting, what needs the person today, and every menu they can open. Only counts they are allowed to see are looked up. */
export default async function BrandHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, brand, actor } = await requireBrand(slug);
  const access = await accessFor(brand.id, actor);
  const tz = hubTz();
  const today = todayIn(tz);
  const base = `/hub/b/${brand.slug}`;

  // A failed lookup becomes null (nothing said) instead of breaking Home.
  const [tasks, unread, stock] = await Promise.all([
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
  ]);
  const counts = { tasks, unread, stock };
  const signals = buildSignals(base, counts);
  const watching = tasks !== null || unread !== null || stock !== null;
  const menus = visibleTabs(access).filter((k) => k !== "home");
  const dateLine = new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date());

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-title text-balance text-h2 text-ink-800 sm:text-h1">{greeting(hourIn(tz))}</h1>
        <p className="mt-2 text-body text-ink-500">{dateLine}</p>
      </header>

      {watching && (
        <section aria-labelledby="needs-you">
          <h2 id="needs-you" className="mb-4 font-title text-h3 text-ink-800">
            Needs you
          </h2>
          {signals.length === 0 ? (
            <div data-acc="finance" className="flex items-center gap-4 rounded-bubble border border-hairline bg-paper-0 p-4 shadow-raised">
              <span aria-hidden className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-(--acc-tint) text-(--acc-ink)">
                <CircleCheck className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="text-body font-semibold text-ink-800">You&apos;re all caught up</p>
                <p className="text-small text-ink-500">Nothing is late, unread or running low.</p>
              </div>
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {signals.map((s) => {
                const Icon = MENU[s.menu].icon;
                return (
                  <li key={s.key}>
                    <Link
                      href={s.href}
                      data-acc={s.menu}
                      className="hit-44 flex items-center gap-4 rounded-bubble border border-hairline bg-paper-0 p-4 shadow-raised transition-shadow hover:shadow-overlay motion-reduce:transition-none"
                    >
                      <span aria-hidden className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-(--acc-tint) text-(--acc-ink)">
                        <Icon className="size-6" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-body font-semibold text-ink-800">{s.title}</span>
                        {s.detail && <span className="block text-small text-ink-500">{s.detail}</span>}
                      </span>
                      <ChevronRight className="size-5 shrink-0 text-ink-300" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="your-menus">
        <h2 id="your-menus" className="mb-4 font-title text-h3 text-ink-800">
          Your menus
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {menus.map((k) => {
            const { label, icon: Icon } = MENU[k];
            const note = tileNote(k, counts);
            return (
              <li key={k}>
                <Link
                  href={`${base}/${k}`}
                  data-acc={k}
                  className="hit-44 flex min-h-32 flex-col justify-between gap-4 rounded-bubble bg-(--acc-tint) p-5 transition-transform active:scale-[0.98] motion-reduce:transition-none"
                >
                  <span aria-hidden className="inline-flex size-11 items-center justify-center rounded-full bg-paper-0/70 text-(--acc-ink)">
                    <Icon className="size-5" />
                  </span>
                  <span>
                    <span className="block font-title text-body font-bold text-(--acc-ink)">{label}</span>
                    {note && <span className={`block text-caption ${SUB}`}>{note}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
