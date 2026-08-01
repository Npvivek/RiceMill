create extension if not exists pgcrypto;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_size integer not null check (file_size between 1 and 20971520),
  file_hash text not null check (file_hash ~ '^[a-f0-9]{64}$'),
  analyzed_at timestamptz not null default now(),
  date_from date,
  date_to date,
  income numeric(16, 2) not null default 0,
  expenses numeric(16, 2) not null default 0,
  net numeric(16, 2) not null default 0,
  transaction_count integer not null default 0 check (transaction_count >= 0),
  sheet_count integer not null default 0 check (sheet_count >= 0),
  source_rows integer not null default 0 check (source_rows >= 0),
  parser_version text not null default '1',
  analysis jsonb not null check (jsonb_typeof(analysis) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, file_hash)
);

create index if not exists reports_user_created_idx
  on public.reports (user_id, created_at desc);

alter table public.reports enable row level security;

create policy "Users can view their own reports"
  on public.reports for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can save their own reports"
  on public.reports for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own reports"
  on public.reports for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own reports"
  on public.reports for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_reports_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_reports_updated_at();
