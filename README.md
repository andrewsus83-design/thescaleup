# ScaleUp — Autonomous Growth Platform

AI-powered growth & scale-up engine. A client submits ~8 pieces of business
info; a multi-API pipeline + a "virtual executive board" of AI agents (CMO, CBO,
CTO, Creative + a Red Team verifier) returns a business health score, revenue
leak analysis, and a done-for-you scale-up roadmap.

This repository holds the staff app (the login and the Chat Room), the Report
platform, and the clients' public booking pages and mini-sites, all on one
Supabase instance. The original public landing page & blog (marketing + lead
generation) is archived.

## What the site is now

For now the site is just the **login**: `/` goes to `/admin/login`, and after logging in an
admin lands on the **Chat Room** (`/room/chat`). Clients have no portal: they only get a
report link (the Report platform's client page `/report/c/<slug>`, or a static report in
`public/r/`). The old landing site, the old admin dashboard and the client dashboard were
archived on 2026-10-26: see `archive/README.md` for what each held and how to restore it.

## Stack

- **Next.js 16** (App Router, React 19) · **TypeScript**
- **Tailwind CSS v4** (CSS-first `@theme`) · custom brand design system
- **Supabase** (Postgres, project `nwrmggfejaxjryhdrhqb`) — lead capture & data
- **Vercel** — hosting & CI/CD

## Brand system

- **Fonts:** Plus Jakarta Sans (display) · Inter (body) · JetBrains Mono ·
  Syne (art) — all via `next/font`.
- **Palette:** Electric Coral `#FF5733` / Deep Sunset `#E03E1A` / ember
  `#FF9A3D` over Obsidian `#0A1020`. Tokens live in `app/globals.css`.
- All brand + page content lives in `lib/site.ts` (single source of truth).

## Structure

```
app/
  page.tsx              "/" → the login
  admin/                login, access-code and logout routes (+ a redirect for old /admin/* URLs)
  room/                 the Chat Room (admins only)
  report/               the Report platform: /report/admin, and the client link /report/c/<slug>
  book/ , site/         public booking pages and the clients' mini-sites
components/             room/ (Chat Room), brand/ (logo), report/, booking/, builders/, admin/ (login form)
lib/                    admin/ (auth), room/ (mock data), report/, engine/, builders/, supabase/
archive/                the old landing site, admin dashboard and client dashboard (not built)
supabase/migrations/    schema
```

## Local development

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase keys
pnpm dev                      # http://localhost:3000
```

## Environment variables

See `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` is a server-only secret used by
`/api/lead`; never expose it client-side.

## Database

Apply `supabase/migrations/20260905090000_leads.sql` (Supabase SQL editor or
`supabase db push`). The `leads` table is RLS-locked; inserts happen server-side.
