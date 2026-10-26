# Old admin dashboard (archived 2026-10-26)

The dark/coral admin backend that used to live at `/admin`. Since 2026-10-26 admins land on the **Chat Room** (`/room/chat`) after logging in, and every old `/admin/*` URL redirects there.

Nothing in this folder is built, type-checked or linted: `tsconfig.json` and `eslint.config.mjs` exclude `archive/`, and `app/globals.css` has `@source not "../archive"`. The code is here for reference and for restoring.

## What is archived (same paths as in the repo root)

| Path | What it was |
| --- | --- |
| `app/admin/(app)/` | The shell layout and the pages: Dashboard (index), Member (+ detail, "Process Now"), Report (+ detail, download), Master Plan, Calendar, Builder (+ detail), Hub (ScaleHub articles), Assets, Setting (API keys), User Management |
| `components/admin/` | `admin-shell`, `article-form`, `confirm-submit`, `member-actions`, `plan-status-select`, `report-status-select` |
| `lib/admin/` | `actions.ts` (server actions of those pages), `article-actions.ts` |

## What stayed in the app

- `/admin/login`, `/admin/access`, `/admin/logout` and `components/admin/login-form.tsx`: the login. They send admins to the Chat Room (`lib/admin/landing.ts`). On the report subdomain they still go to `/admin`, which `proxy.ts` maps to `/report/admin`.
- `app/admin/[[...slug]]/route.ts`: redirects every other `/admin/*` URL to the Chat Room.
- `lib/admin/auth.ts`, `access.ts`, `config.ts` (its `adminNav` is unused while this is archived), `builder-actions.ts`, `plan-status.ts` and `components/admin/ui.tsx`: still used by the Chat Room, the Report platform, the client dashboard and the public site.

## What you lose while it is archived

There is no screen for: processing leads (running the audit engine on a lead), reading or editing members and their reports, the master plan and calendar, the builder projects of a member, ScaleHub (Hub) articles, the API keys in `app_settings` that the old audit engine reads, and admin user management on the main host (the Report platform has its own at `/report/admin/users`). The data is untouched: every table and every key is still in Supabase and still used by the engine and the public site; only the screens are gone.

## Restore

From the repo root:

```bash
cp -R archive/old-admin-dashboard/app archive/old-admin-dashboard/components archive/old-admin-dashboard/lib .
git rm "app/admin/[[...slug]]/route.ts"
```

Then change `adminLanding()` in `lib/admin/landing.ts` to return `/admin` again, so the login lands on the old dashboard.
