# Old landing site (archived 2026-10-26)

The dark/coral public site: the landing page, How it works, Executive board, FAQ, the blog, the Typeform-style onboarding (`/mulai`) and the public ScaleHub (Hub) articles. For now the site is just the login: `/` redirects to `/admin/login`, and the old URLs (`/cara-kerja`, `/executive-board`, `/faq`, `/mulai`, `/blog/*`, `/scalehub/*`) redirect there too (`next.config.ts`).

Nothing in this folder is built, type-checked or linted (`tsconfig.json`, `eslint.config.mjs`, and `@source not` in `app/globals.css` skip `archive/`).

## What is archived (same paths as in the repo root)

| Path | What it was |
| --- | --- |
| `app/page.tsx` | The landing page |
| `app/cara-kerja/`, `executive-board/`, `faq/`, `blog/`, `mulai/`, `scalehub/` | The public pages (blog articles, onboarding funnel, Hub index + article pages) |
| `app/opengraph-image.tsx`, `app/sitemap.ts` | The share image and the sitemap of that site |
| `app/api/lead/` | The lead-capture endpoint behind `/mulai` (writes to the `leads` table) |
| `components/landing/`, `components/onboarding/`, `components/ui/`, `components/fx/reveal.tsx`, `components/scalehub/article-grid.tsx` | The page sections and UI kit |
| `lib/blog.ts`, `lib/scalehub/data.ts` | The blog content and the Hub article queries |
| `public/hero.jpg` | The hero image |

## What stayed

- `lib/site.ts` (site name, URL and copy), `components/fx/parallax-bg.tsx` and `app/layout.tsx`: still used by the root layout and the clients' mini-sites.
- `/book/*` (public booking pages) and `/site/*` (the clients' mini-sites) were not touched.
- `app/robots.ts` now allows only `/site/` and hides everything else; the sitemap is gone.
- The `leads` table and every other table are untouched. Only the pages and the endpoint are gone: while this is archived nothing can create a new lead.

## Restore

From the repo root:

```bash
cp -R archive/old-landing-site/app archive/old-landing-site/components archive/old-landing-site/lib archive/old-landing-site/public .
```

That overwrites `app/page.tsx` (the login redirect). Then remove `ARCHIVED_PATHS` entries for the pages you brought back in `next.config.ts`, and put the sitemap back in `app/robots.ts` (`sitemap: "<site url>/sitemap.xml"` and `allow: "/"`).
