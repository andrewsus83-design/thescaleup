-- ============================================================================
-- Hub helpers: look up an auth user by email, server side only.
--
-- Used by the sign-in flow to decide whether an email is known (a brand member,
-- or someone with an open invite) before any login code is sent. PostgREST does
-- not expose the auth schema, so this goes through a function that only the
-- service role can call.
-- Idempotent.
-- ============================================================================
create or replace function public.user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1
$$;

revoke all on function public.user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text) to service_role;
