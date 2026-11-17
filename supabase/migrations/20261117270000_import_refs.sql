-- Imports from other tools (ClickUp first): remembers which page or task came from which outside item, so running an import
-- again skips what is already here instead of making copies. Deleting the page or task also forgets the link, so a deleted
-- item comes back on the next import. Server-only like the other hub tables: RLS is on with no policy.

create table if not exists public.import_refs (
  brand_id uuid not null references public.brands(id) on delete cascade,
  source text not null check (source in ('clickup')),
  kind text not null check (kind in ('doc_page', 'task')),
  -- The outside id (for a Doc page: "<doc id>:<page id>", or "<doc id>:root" for the page made for a Doc with several pages; for a task: its id).
  external_id text not null check (char_length(external_id) between 1 and 120),
  page_id uuid references public.wiki_pages(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (brand_id, source, kind, external_id),
  check ((kind = 'doc_page' and page_id is not null and task_id is null) or (kind = 'task' and task_id is not null and page_id is null))
);
create index if not exists import_refs_page_idx on public.import_refs (page_id) where page_id is not null;
create index if not exists import_refs_task_idx on public.import_refs (task_id) where task_id is not null;

alter table public.import_refs enable row level security;
revoke all on public.import_refs from anon, authenticated;
