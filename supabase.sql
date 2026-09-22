create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  q1 text not null,
  q2 text not null,
  q3 text[] not null default '{}',
  q4 text not null,
  q5 text not null,
  q6 text not null default ''
);

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
alter publication supabase_realtime add table public.survey_responses;


