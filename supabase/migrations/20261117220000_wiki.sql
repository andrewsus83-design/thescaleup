-- Wiki: what a brand knows about itself, as pages in a tree. Markdown body, a type, tags, full-text search and a history of earlier versions.
-- Server-only like the other hub tables: RLS is on with no policy, so the browser's keys cannot read or write any of it.
-- The app reads and writes with the service role after checking the person's role and their Wiki access level.

create table if not exists public.wiki_pages (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  parent_id uuid references public.wiki_pages(id) on delete set null,
  -- Stays the same when a page is renamed, so links keep working.
  slug text not null check (slug ~ '^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$'),
  title text not null check (char_length(title) between 1 and 120),
  summary text not null default '' check (char_length(summary) <= 300),
  body text not null default '' check (char_length(body) <= 50000),
  type text not null default 'other' check (type in ('brand', 'product', 'sop', 'training', 'research', 'update', 'customer', 'person', 'faq', 'other')),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  -- AI features read only pages with this on.
  ai_readable boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 'simple' keeps words as they are (no English stemming), which suits Indonesian and English text mixed on one page.
  search tsvector generated always as (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(body, ''))) stored
);
create unique index if not exists wiki_pages_slug_uidx on public.wiki_pages (brand_id, slug);
create index if not exists wiki_pages_parent_idx on public.wiki_pages (brand_id, parent_id);
create index if not exists wiki_pages_type_idx on public.wiki_pages (brand_id, type);
create index if not exists wiki_pages_search_idx on public.wiki_pages using gin (search);
create index if not exists wiki_pages_tags_idx on public.wiki_pages using gin (tags);

drop trigger if exists wiki_pages_updated_at on public.wiki_pages;
create trigger wiki_pages_updated_at before update on public.wiki_pages for each row execute function public.set_updated_at();

-- Each time the text of a page changes, what it said until now is kept, with who saved it and when.
create table if not exists public.wiki_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.wiki_pages(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  title text not null,
  summary text not null default '',
  body text not null default '',
  edited_by uuid references auth.users(id) on delete set null,
  edited_at timestamptz not null
);
create index if not exists wiki_versions_page_idx on public.wiki_versions (page_id, edited_at desc);

create or replace function public.wiki_snapshot() returns trigger language plpgsql set search_path = public as $$
begin
  if (old.title, old.summary, old.body) is distinct from (new.title, new.summary, new.body) then
    insert into public.wiki_versions (page_id, brand_id, title, summary, body, edited_by, edited_at)
    values (old.id, old.brand_id, old.title, old.summary, old.body, old.updated_by, old.updated_at);
  end if;
  return new;
end $$;
drop trigger if exists wiki_pages_snapshot on public.wiki_pages;
create trigger wiki_pages_snapshot before update on public.wiki_pages for each row execute function public.wiki_snapshot();

alter table public.wiki_pages enable row level security;
alter table public.wiki_versions enable row level security;
revoke all on public.wiki_pages, public.wiki_versions from anon, authenticated;
