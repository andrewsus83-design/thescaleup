import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CircleCheck } from "lucide-react";
import { Card, Chip, EmptyState, PageHeader } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { MENU } from "@/components/hub/menus";
import { accessFor } from "@/lib/hub/access";
import { requireBrand } from "@/lib/hub/session";
import { dueInfo, fmtDay, hubTz, todayIn } from "@/lib/hub/tasks/dates";
import { loadToday } from "@/lib/hub/today/data";
import { isEmpty, LIMITS } from "@/lib/hub/today/model";
import { CHANNEL_LABEL, isChannel, STATUS_LABEL, STATUS_TONE, isStatus } from "@/lib/hub/content/model";

export const metadata: Metadata = { title: "What's today" };
export const dynamic = "force-dynamic";

/** What is late or due, what is planned and who to follow up with, for today. Mine by default, or the whole team's. */
export default async function TodayPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ scope?: string }> }) {
  const [{ slug }, { scope: rawScope }] = await Promise.all([params, searchParams]);
  const { user, brand, actor } = await requireBrand(slug);
  const access = await accessFor(brand.id, actor);
  const tz = hubTz();
  const day = todayIn(tz);
  const base = `/hub/b/${brand.slug}`;
  const scope = rawScope === "team" ? "team" : "me";
  const t = await loadToday({ brandId: brand.id, actor, userId: user.id, access, day, scope });
  const dateLine = new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date());
  const tab = (key: "me" | "team", label: string) => (
    <Link
      href={key === "me" ? `${base}/today` : `${base}/today?scope=team`}
      aria-current={scope === key ? "page" : undefined}
      className={btnCls(scope === key ? "dark" : "secondary", "sm")}
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <Link href={base} className="inline-flex min-h-11 items-center gap-2 text-small font-semibold text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Home
      </Link>
      <PageHeader title="What's today" description={dateLine} />
      {t.tasks && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Whose tasks">
          {tab("me", "Mine")}
          {tab("team", "Whole team")}
        </div>
      )}

      {isEmpty(t) && (
        <div className="flex items-center gap-4 rounded-bubble border border-hairline bg-paper-0 p-4 shadow-raised">
          <span aria-hidden className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-ink">
            <CircleCheck className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="text-body font-semibold text-ink-800">Nothing is late, due or planned today</p>
            <p className="text-small text-ink-500">{t.tasks || t.people || t.content || t.unread !== null ? "Enjoy the quiet, or plan what comes next." : "You do not have access to any of the menus this page reads."}</p>
          </div>
        </div>
      )}

      {t.tasks && t.tasks.items.length > 0 && (
        <section aria-labelledby="td-tasks" className="space-y-3" data-acc="tasks">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="td-tasks" className="font-title text-h3 text-ink-800">
              Tasks
            </h2>
            <p className="text-small text-ink-500">
              {t.tasks.late > 0 && `${t.tasks.late} late`}
              {t.tasks.late > 0 && t.tasks.today > 0 && ", "}
              {t.tasks.today > 0 && `${t.tasks.today} due today`}
            </p>
          </div>
          <ul className="space-y-2">
            {t.tasks.items.slice(0, LIMITS.page).map((x) => {
              const d = dueInfo(x.due, day);
              return (
                <li key={x.id}>
                  <Link href={`${base}/tasks/${x.id}`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                    <Card small interactive>
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate font-semibold text-ink-800">{x.title}</p>
                        <Chip tone={d.tone === "bad" ? "bad" : d.tone === "warn" ? "warn" : "neutral"}>{d.label}</Chip>
                      </div>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
          {t.tasks.items.length > LIMITS.page && (
            <Link href={`${base}/tasks`} className="text-small font-semibold text-ink-700 underline">
              See all {t.tasks.items.length} in Tasks
            </Link>
          )}
        </section>
      )}

      {t.people && t.people.total > 0 && (
        <section aria-labelledby="td-crm" className="space-y-3" data-acc="crm">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="td-crm" className="font-title text-h3 text-ink-800">
              Follow up with
            </h2>
            <p className="text-small text-ink-500">{t.people.total} due</p>
          </div>
          <ul className="space-y-2">
            {t.people.items.map((p) => (
              <li key={p.id}>
                <Link href={`${base}/crm/${p.id}`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                  <Card small interactive>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink-800">{p.name}</p>
                        <p className="truncate text-small text-ink-500">
                          {p.kind === "client" ? "Client" : "Lead"}
                          {p.company ? `, ${p.company}` : ""}
                        </p>
                      </div>
                      <Chip tone={p.late ? "bad" : "warn"}>{p.late ? `Since ${fmtDay(p.next_follow_up)}` : "Today"}</Chip>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
          {t.people.total > t.people.items.length && (
            <Link href={`${base}/crm`} className="text-small font-semibold text-ink-700 underline">
              See all {t.people.total} in CRM
            </Link>
          )}
        </section>
      )}

      {t.content && t.content.items.length > 0 && (
        <section aria-labelledby="td-content" className="space-y-3" data-acc="content">
          <h2 id="td-content" className="font-title text-h3 text-ink-800">
            Content planned today
          </h2>
          <ul className="space-y-2">
            {t.content.items.map((c) => (
              <li key={c.id}>
                <Link href={`${base}/content/${c.id}`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                  <Card small interactive>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink-800">{c.title}</p>
                        {c.channel && isChannel(c.channel) && <p className="text-small text-ink-500">{CHANNEL_LABEL[c.channel]}</p>}
                      </div>
                      {isStatus(c.status) && <Chip tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Chip>}
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {t.unread ? (
        <section aria-labelledby="td-mail" data-acc="mail">
          <h2 id="td-mail" className="sr-only">
            Mail
          </h2>
          <Link href={`${base}/mail`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <Card small interactive>
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = MENU.mail.icon;
                  return <Icon className="size-5 text-ink-500" aria-hidden />;
                })()}
                <p className="font-semibold text-ink-800">
                  {t.unread} unread {t.unread === 1 ? "email" : "emails"}
                </p>
              </div>
            </Card>
          </Link>
        </section>
      ) : null}

      {!t.tasks && !t.people && !t.content && t.unread === null && <EmptyState title="Nothing to show here" hint="Today reads Tasks, CRM, Content and Mail. Ask the owner for access to any of them." />}
    </div>
  );
}
