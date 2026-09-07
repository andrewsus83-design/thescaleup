-- Tag plan items with the builder (product/service) they belong to.
alter table public.plan_items add column if not exists builder text;
create index if not exists plan_items_builder_idx on public.plan_items(builder);
