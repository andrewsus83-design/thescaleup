-- Telegram: the chats a brand has linked to its bot (a person, a team group, a channel). The bot token itself is stored
-- encrypted with the other keys (brand_secrets, provider 'telegram'); nothing here is a secret, but it is private to the brand.
-- Server-only like the other hub tables: RLS is on with no policy. Safe to run twice.

create table if not exists public.telegram_chats (
  brand_id uuid not null references public.brands(id) on delete cascade,
  chat_id bigint not null,
  kind text not null check (kind in ('private', 'group', 'supergroup', 'channel')),
  title text not null default '' check (char_length(title) <= 120),
  linked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (brand_id, chat_id)
);

alter table public.telegram_chats enable row level security;
revoke all on public.telegram_chats from anon, authenticated;
