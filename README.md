# ScaleUp — Autonomous Growth Platform

AI-powered growth & scale-up engine. A client submits ~8 pieces of business
info; a multi-API pipeline + a "virtual executive board" of AI agents (CMO, CBO,
CTO, Creative + a Red Team verifier) returns a business health score, revenue
leak analysis, and a done-for-you scale-up roadmap.

This repository currently contains **Platform 1 — the public landing page &
blog** (marketing + lead generation). The Admin backend and Client dashboard,
plus the analysis engine, are built on the same Supabase instance.

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
  page.tsx              Landing (home)
  cara-kerja/           How it works
  executive-board/      The AI executive board
  faq/                  FAQ
  blog/ , blog/[slug]/  Blog index + articles (Article JSON-LD)
  mulai/                Full-screen Typeform-style 5-step onboarding
  dashboard/            Client dashboard (placeholder)
  api/lead/             Lead capture endpoint (→ Supabase `leads`)
components/
  landing/  ui/  fx/  onboarding/
lib/                    site.ts (content), blog.ts, utils.ts
supabase/migrations/    leads table
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
