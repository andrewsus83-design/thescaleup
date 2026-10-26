# Old client dashboard (archived 2026-10-26)

The client portal at `/dashboard`: clients logged in with an access code and saw their score and report, the plan board, the calendar, their products (booking, CRM, website builder) and the Hub. Clients no longer get a portal: they only receive a report link to look at (the Report platform's client page at `/report/c/<slug>`, or a static report under `public/r/`). `/dashboard/*` redirects to the login (`next.config.ts`).

Nothing in this folder is built, type-checked or linted (`tsconfig.json`, `eslint.config.mjs`, and `@source not` in `app/globals.css` skip `archive/`).

## What is archived (same paths as in the repo root)

| Path | What it was |
| --- | --- |
| `app/dashboard/` | `login`, `enter` (open a member's dashboard), `session`, `logout`, and the `(app)` pages: overview, `report`, `score`, `plan`, `calendar`, `reminders`, `scalehub`, `app/[slug]` (the products), `builder/[slug]` |
| `components/client/` | `client-shell`, `reminder-list` |
| `components/calendar/`, `components/crm/`, `components/plan/` | The calendar, the CRM board and the plan board |
| `components/booking/booking-dashboard.tsx` | The owner's side of the booking product (the public booking widget stayed) |
| `components/report/report-view.tsx`, `success-meter.tsx` | The old audit report view (the Report platform's own components stayed) |
| `components/admin/ui.tsx` | The dark UI kit (`PageHeader`, `Card`, `StatusBadge`…) that the old dashboards shared |
| `lib/client/actions.ts`, `lib/client/builders.ts`, `lib/crm/`, `lib/builders.ts`, `lib/admin/plan-status.ts` | The server actions, queries and catalogue of those pages |
| `components/landing/logo.tsx`, `components/ui/score-ring.tsx`, `lib/blog.ts`, `lib/scalehub/data.ts` | Copies of files this dashboard shared with the old landing site (the originals are in `archive/old-landing-site`) |

## What stayed

- `lib/client/auth.ts` (the client session), still used by `lib/booking/actions.ts`, plus `/book/*` and `/site/*`.
- `lib/builders/**` (builder configs and website templates), `lib/engine/**` (the audit engine) and `lib/admin/builder-actions.ts`: not used by any page right now, kept as they are for the Chat Room's builder and audits.
- Data: every table (`members`, `plan_items`, `crm_contacts`, `bookings`, …) is untouched.

## What you lose while it is archived

Clients can't log in to see their score, plan, calendar, CRM, booking owner view or Hub; the owner side of the booking product (confirm or cancel a booking) has no screen. Public booking pages and mini-sites keep working.

## Restore

From the repo root:

```bash
cp -R archive/old-client-dashboard/app archive/old-client-dashboard/components archive/old-client-dashboard/lib .
```

Then remove `"/dashboard/:path*"` from `ARCHIVED_PATHS` in `next.config.ts`. The dashboard also needs the old site's `components/ui/*` (`button`, `badge`, `container`, `section-heading`) if any restored page imports them: copy them from `archive/old-landing-site`.
