create extension if not exists pgcrypto;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(), name text not null check (char_length(name) between 1 and 120),
  created_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now()
);
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')), created_at timestamptz not null default now(), primary key (workspace_id, user_id)
);

create or replace function public.is_workspace_member(requested_workspace_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members where workspace_id = requested_workspace_id and user_id = auth.uid());
$$;
create or replace function public.add_workspace_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin insert into public.workspace_members (workspace_id, user_id, role) values (new.id, new.created_by, 'owner'); return new; end;
$$;
create trigger workspaces_add_owner after insert on public.workspaces for each row execute function public.add_workspace_owner();

create table public.imports (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict, file_name text not null check (char_length(file_name) between 1 and 255),
  file_hash text not null check (file_hash ~ '^[a-f0-9]{64}$'), file_size integer not null check (file_size > 0 and file_size <= 10485760),
  storage_path text not null unique, parser_version text not null, status text not null check (status in ('staged','parsing','review_required','committed','failed','cancelled')),
  error_code text, error_message text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (workspace_id, file_hash)
);
create table public.dataset_versions (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  import_id uuid not null references public.imports(id) on delete restrict, parent_version_id uuid references public.dataset_versions(id) on delete restrict,
  version_number integer not null check (version_number > 0), status text not null check (status in ('draft','committed','superseded')),
  created_by uuid not null references auth.users(id) on delete restrict, committed_at timestamptz, created_at timestamptz not null default now(), unique (import_id, version_number)
);
create table public.source_rows (
  id uuid primary key default gen_random_uuid(), dataset_version_id uuid not null references public.dataset_versions(id) on delete cascade,
  sheet_name text not null, row_number integer not null check (row_number > 0), raw_cells jsonb not null check (jsonb_typeof(raw_cells) = 'object'),
  parse_status text not null check (parse_status in ('included','excluded','review_required')), exclusion_reason text, created_at timestamptz not null default now(),
  unique (dataset_version_id, sheet_name, row_number)
);
create table public.transactions (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dataset_version_id uuid not null references public.dataset_versions(id) on delete cascade, source_row_id uuid not null unique references public.source_rows(id) on delete restrict,
  transaction_date date not null, description text not null check (char_length(description) between 1 and 2000), direction text not null check (direction in ('income','expense')),
  amount numeric(18,2) not null check (amount >= 0), category text not null check (char_length(category) between 1 and 120), party_name text,
  quantity numeric(18,3), quantity_unit text, created_at timestamptz not null default now()
);
create index transactions_workspace_date_idx on public.transactions (workspace_id, transaction_date desc);
create index transactions_dataset_category_idx on public.transactions (dataset_version_id, category, transaction_date desc);
create table public.mapping_corrections (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dataset_version_id uuid not null references public.dataset_versions(id) on delete cascade, source_row_id uuid not null references public.source_rows(id) on delete restrict,
  corrected_by uuid not null references auth.users(id) on delete restrict, correction jsonb not null check (jsonb_typeof(correction) = 'object'), created_at timestamptz not null default now()
);
create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dataset_version_id uuid not null references public.dataset_versions(id) on delete restrict, requested_by uuid not null references auth.users(id) on delete restrict,
  graph_version text not null, prompt_version text not null, model_id text not null,
  status text not null check (status in ('queued','running','waiting_review','completed','partial','failed','cancelled')), active_lease_until timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0), error_code text, error_message text, started_at timestamptz, completed_at timestamptz,
  created_at timestamptz not null default now(), unique (dataset_version_id, graph_version, prompt_version, model_id)
);
create table public.tool_results (
  id uuid primary key default gen_random_uuid(), analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  tool_name text not null, input jsonb not null check (jsonb_typeof(input) = 'object'), result jsonb not null check (jsonb_typeof(result) in ('object','array')), created_at timestamptz not null default now()
);
create table public.findings (
  id uuid primary key default gen_random_uuid(), analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  finding_type text not null check (finding_type in ('observation','hypothesis','data_quality')), severity text not null check (severity in ('info','review','important')),
  title text not null check (char_length(title) between 1 and 180), explanation text not null check (char_length(explanation) between 1 and 4000),
  metric_refs jsonb not null check (jsonb_typeof(metric_refs) = 'array'), source_refs jsonb not null check (jsonb_typeof(source_refs) = 'array'), limitations text not null, suggested_check text, created_at timestamptz not null default now()
);
create table public.graph_checkpoints (
  id uuid primary key default gen_random_uuid(), analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  checkpoint_key text not null, parent_checkpoint_key text, state jsonb not null check (jsonb_typeof(state) = 'object'), created_at timestamptz not null default now(), unique (analysis_run_id, checkpoint_key)
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dataset_version_id uuid not null references public.dataset_versions(id) on delete restrict, created_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now()
);
create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade,
  author_type text not null check (author_type in ('user','assistant')), content text not null check (char_length(content) between 1 and 8000), created_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger imports_set_updated_at before update on public.imports for each row execute function public.set_updated_at();

do $$ declare table_name text; begin
  foreach table_name in array array['workspaces','workspace_members','imports','dataset_versions','source_rows','transactions','mapping_corrections','analysis_runs','tool_results','findings','graph_checkpoints','conversations','conversation_messages'] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end; $$;
create policy "Workspace members view workspaces" on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy "Users create workspaces" on public.workspaces for insert to authenticated with check (created_by = auth.uid());
create policy "Workspace members view memberships" on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "Workspace members view imports" on public.imports for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members view versions" on public.dataset_versions for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members view transactions" on public.transactions for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members view corrections" on public.mapping_corrections for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members view analysis" on public.analysis_runs for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members view conversations" on public.conversations for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members view source rows" on public.source_rows for select to authenticated using (exists (select 1 from public.dataset_versions where id = dataset_version_id and public.is_workspace_member(workspace_id)));
create policy "Workspace members view tool results" on public.tool_results for select to authenticated using (exists (select 1 from public.analysis_runs where id = analysis_run_id and public.is_workspace_member(workspace_id)));
create policy "Workspace members view findings" on public.findings for select to authenticated using (exists (select 1 from public.analysis_runs where id = analysis_run_id and public.is_workspace_member(workspace_id)));
create policy "Workspace members view checkpoints" on public.graph_checkpoints for select to authenticated using (exists (select 1 from public.analysis_runs where id = analysis_run_id and public.is_workspace_member(workspace_id)));
create policy "Workspace members view messages" on public.conversation_messages for select to authenticated using (exists (select 1 from public.conversations where id = conversation_id and public.is_workspace_member(workspace_id)));
revoke all on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;

create or replace function public.workspace_id_from_storage_path(object_name text) returns uuid language plpgsql immutable set search_path = '' as $$
begin return (storage.foldername(object_name))[1]::uuid; exception when invalid_text_representation then return null; end;
$$;
revoke all on function public.workspace_id_from_storage_path(text) from public;
grant execute on function public.workspace_id_from_storage_path(text) to authenticated;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mill-workbooks','mill-workbooks',false,10485760,array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "Workspace members read workbooks" on storage.objects for select to authenticated using (bucket_id = 'mill-workbooks' and public.is_workspace_member(public.workspace_id_from_storage_path(name)));
create policy "Workspace members upload workbooks" on storage.objects for insert to authenticated with check (bucket_id = 'mill-workbooks' and owner_id = auth.uid()::text and public.is_workspace_member(public.workspace_id_from_storage_path(name)));
create policy "Workspace members remove workbooks" on storage.objects for delete to authenticated using (bucket_id = 'mill-workbooks' and public.is_workspace_member(public.workspace_id_from_storage_path(name)));
