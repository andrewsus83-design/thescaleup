-- Mail: a conversation can be deleted into Trash (and restored), then deleted for good from there.
-- Safe to run twice. It only widens the allowed values of mail_threads.status; no data is changed.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.mail_threads'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.mail_threads drop constraint %I', c);
  end loop;
  alter table public.mail_threads add constraint mail_threads_status_check check (status in ('open', 'done', 'trash'));
end $$;
