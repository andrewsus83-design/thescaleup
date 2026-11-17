-- Telegram, both ways: people link their own Telegram to their hub login (so a command runs as that person, with their role), and the
-- bot can answer. Nothing here is a secret that opens anything on its own, but all of it is private to the brand.
-- Server-only like the other hub tables: RLS is on with no policy. Safe to run twice.

-- Who is who. One Telegram account per person per brand, and one person per Telegram account.
create table if not exists public.telegram_links (
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tg_user_id bigint not null,
  -- The person's private chat with the bot: where personal answers and alerts go.
  chat_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (brand_id, user_id),
  unique (brand_id, tg_user_id)
);
alter table public.telegram_links enable row level security;
revoke all on public.telegram_links from anon, authenticated;

-- One-time codes that prove "this Telegram is that hub login". Only a hash is kept, the code works once, and it expires.
create table if not exists public.telegram_codes (
  code_hash text primary key,
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists telegram_codes_user_idx on public.telegram_codes (brand_id, user_id);
alter table public.telegram_codes enable row level security;
revoke all on public.telegram_codes from anon, authenticated;

-- Telegram numbers every message. Handling one at most once means a retry from Telegram cannot add a task twice.
create table if not exists public.telegram_updates (
  brand_id uuid not null references public.brands(id) on delete cascade,
  update_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (brand_id, update_id)
);
alter table public.telegram_updates enable row level security;
revoke all on public.telegram_updates from anon, authenticated;

-- The chats the bot has heard from. While commands are on, Telegram does not allow asking it for recent chats, so the hub keeps its own list.
create table if not exists public.telegram_seen (
  brand_id uuid not null references public.brands(id) on delete cascade,
  chat_id bigint not null,
  kind text not null check (kind in ('private', 'group', 'supergroup', 'channel')),
  title text not null default '' check (char_length(title) <= 120),
  seen_at timestamptz not null default now(),
  primary key (brand_id, chat_id)
);
alter table public.telegram_seen enable row level security;
revoke all on public.telegram_seen from anon, authenticated;

notify pgrst, 'reload schema';
