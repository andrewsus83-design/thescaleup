-- Content: the posts, emails, ads and replies a brand plans and writes. One row per piece, with the day it should go out.
-- Server-only like the Mail tables: RLS is on and there is no policy, so the browser's keys cannot read or write any of it.
-- The app reads and writes with the service role after checking the person's role and the Content access level.

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 20000),
  kind text not null default 'post' check (kind in ('post', 'caption', 'ad', 'email', 'blog', 'reply', 'other')),
  channel text check (channel is null or channel in ('instagram', 'facebook', 'tiktok', 'linkedin', 'x', 'youtube', 'whatsapp', 'email', 'blog', 'other')),
  -- "posted" is marked by hand until publishing is connected.
  status text not null default 'draft' check (status in ('idea', 'draft', 'review', 'approved', 'posted')),
  scheduled_for date,
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_items_brand_day_idx on public.content_items (brand_id, scheduled_for);
create index if not exists content_items_brand_status_idx on public.content_items (brand_id, status);

drop trigger if exists content_items_updated_at on public.content_items;
create trigger content_items_updated_at before update on public.content_items for each row execute function public.set_updated_at();

alter table public.content_items enable row level security;
revoke all on public.content_items from anon, authenticated;
