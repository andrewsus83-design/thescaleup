-- Telegram: a chat can get the team's day every morning. Safe to run twice.
alter table public.telegram_chats add column if not exists daily boolean not null default false;
-- the last day (hub time) a summary was sent, so a retry or a second run never sends it twice
alter table public.telegram_chats add column if not exists last_daily date;
