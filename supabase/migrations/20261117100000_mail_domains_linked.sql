-- A domain can already live in the agency's Resend account (other projects send from it). The hub links to it instead of
-- creating it, and must never delete it from Resend when it is removed here.
alter table public.mail_domains add column if not exists linked boolean not null default false;
