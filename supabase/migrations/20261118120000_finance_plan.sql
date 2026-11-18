-- Finance plan: what a brand expects to bring in and to spend each month, per category.
-- One standing monthly plan per brand; the pages compare it with what was really entered.
-- Service role only, like the rest of Finance.

create table if not exists public.fin_budgets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  kind text not null check (kind in ('in', 'out')),
  category text not null check (char_length(category) between 1 and 40),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
-- A category is planned once per kind, whatever the capitals.
create unique index if not exists fin_budgets_one_per_category on public.fin_budgets (brand_id, kind, lower(category));

-- Saving the plan replaces every line at once, so the page never shows half of an old plan and half of a new one.
-- p_rows is a JSON list of {kind, category, amount_cents}. Answers how many lines the plan now has.
create or replace function public.fin_save_plan(p_brand uuid, p_rows jsonb, p_user uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.fin_budgets where brand_id = p_brand;
  insert into public.fin_budgets (brand_id, kind, category, amount_cents, updated_by)
  select p_brand, r.kind, r.category, r.amount_cents, p_user
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(kind text, category text, amount_cents bigint);
  get diagnostics n = row_count;
  return n;
end;
$$;

alter table public.fin_budgets enable row level security;
revoke all on public.fin_budgets from anon, authenticated;
revoke all on function public.fin_save_plan(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.fin_save_plan(uuid, jsonb, uuid) to service_role;
