-- The ClickUp importer can now send a list to the CRM (as leads or clients) or to the Content plan, not only to Tasks. Each
-- imported item is remembered by the new row it became, so a second run skips it. Deleting the lead or content piece forgets
-- the link too. Safe to run twice.

alter table public.import_refs add column if not exists person_id uuid references public.crm_people(id) on delete cascade;
alter table public.import_refs add column if not exists content_id uuid references public.content_items(id) on delete cascade;

alter table public.import_refs drop constraint if exists import_refs_kind_check;
alter table public.import_refs add constraint import_refs_kind_check check (kind in ('doc_page', 'task', 'lead', 'content'));

alter table public.import_refs drop constraint if exists import_refs_check;
alter table public.import_refs drop constraint if exists import_refs_target_check;
alter table public.import_refs add constraint import_refs_target_check check (
  (kind = 'doc_page' and page_id is not null and task_id is null and person_id is null and content_id is null)
  or (kind = 'task' and task_id is not null and page_id is null and person_id is null and content_id is null)
  or (kind = 'lead' and person_id is not null and page_id is null and task_id is null and content_id is null)
  or (kind = 'content' and content_id is not null and page_id is null and task_id is null and person_id is null)
);

create index if not exists import_refs_person_idx on public.import_refs (person_id) where person_id is not null;
create index if not exists import_refs_content_idx on public.import_refs (content_id) where content_id is not null;
