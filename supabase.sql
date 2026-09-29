create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  q1 text not null,
  q2 text not null,
  q3 text not null default '',
  q4 text not null,
  q5 text not null,
  q5_other text not null default '',
  q6 text not null default '',
  q7 text not null default '',
  q8 text not null default ''
);

alter table public.survey_responses
  add column if not exists q5_other text not null default '',
  add column if not exists q7 text not null default '',
  add column if not exists q8 text not null default '';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'survey_responses'
      and column_name = 'q3'
      and data_type = 'ARRAY'
  ) then
    alter table public.survey_responses alter column q3 drop default;
    alter table public.survey_responses
      alter column q3 type text using array_to_string(q3, ', ');
    alter table public.survey_responses alter column q3 set default '';
  end if;
end $$;

alter table public.survey_responses enable row level security;

drop policy if exists "Anyone can submit survey responses" on public.survey_responses;
create policy "Anyone can submit survey responses"
on public.survey_responses
for insert
to anon
with check (true);

drop policy if exists "Anyone can read survey responses" on public.survey_responses;
create policy "Anyone can read survey responses"
on public.survey_responses
for select
to anon
using (true);

drop policy if exists "Anyone can delete survey responses" on public.survey_responses;
create policy "Anyone can delete survey responses"
on public.survey_responses
for delete
to anon
using (true);

-- Habilitar publicaciones en tiempo real en Supabase para actualizaciones instantáneas
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'survey_responses'
  ) then
    alter publication supabase_realtime add table public.survey_responses;
  end if;
end $$;


