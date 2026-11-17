-- Wiki AI Page Builder: one row per run. The app reads a brand's website and social pages, asks the client up to ten questions,
-- then drafts Wiki pages that a person adds or skips. Nothing reaches the Wiki until someone adds it.
-- Server-only like the other hub tables: RLS is on with no policy, so the browser's keys cannot read or write any of it.

create table if not exists public.wiki_builds (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  -- 'asking': waiting for the client's answers. 'ready': pages are drafted and waiting for review.
  status text not null default 'asking' check (status in ('asking', 'ready')),
  -- What the person gave: { website, social: [{id, url}], notes }.
  sources jsonb not null default '{}'::jsonb,
  -- What the app managed to read: [{label, url, ok, chars, note}].
  read jsonb not null default '[]'::jsonb check (jsonb_typeof(read) = 'array'),
  -- The text that was read, trimmed. Kept so the pages can be written later, after the answers are in.
  digest text not null default '' check (char_length(digest) <= 40000),
  questions jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  answers jsonb not null default '{}'::jsonb,
  -- [{id, title, type, summary, body, tags, state: 'new' | 'added' | 'skipped', slug}]
  drafts jsonb not null default '[]'::jsonb check (jsonb_typeof(drafts) = 'array'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wiki_builds_brand_idx on public.wiki_builds (brand_id, created_at desc);

drop trigger if exists wiki_builds_updated_at on public.wiki_builds;
create trigger wiki_builds_updated_at before update on public.wiki_builds for each row execute function public.set_updated_at();

alter table public.wiki_builds enable row level security;
revoke all on public.wiki_builds from anon, authenticated;
