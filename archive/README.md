# Archive

Code that is no longer part of the product but is kept for reference and for restoring. Nothing in `archive/` is built, type-checked or linted: `tsconfig.json` and `eslint.config.mjs` skip it, and `app/globals.css` has `@source not "../archive"`. Each folder mirrors the repo's paths, so restoring is a `cp -R` from the folder onto the repo root; its README says what to do after.

| Folder | What | Archived |
| --- | --- | --- |
| [`old-admin-dashboard/`](old-admin-dashboard/README.md) | The dark admin backend (`/admin`: leads, reports, plans, hub editor, settings…) | 2026-10-26 |
| [`old-client-dashboard/`](old-client-dashboard/README.md) | The client portal (`/dashboard`) | 2026-10-26 |
| [`old-landing-site/`](old-landing-site/README.md) | The public landing site, blog, onboarding funnel and Hub | 2026-10-26 |

What the product is now: the login (`/` → `/admin/login`), the Chat Room for admins (`/room`), the Report platform with its client report links (`/report`, `report.*`), plus the public booking pages (`/book`), the clients' mini-sites (`/site`) and the static reports (`/r`).
