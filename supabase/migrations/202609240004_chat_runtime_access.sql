-- Additive chat storage for langgraph-checkpoint-postgres 3.1.2. Apply with migration credentials.
-- Do not call PostgresSaver.setup() from the web service; mill_runtime has no DDL privileges.
alter table public.conversations add column if not exists mode text not null default 'chat'
  check (mode in ('chat', 'anomalies'));
alter table public.conversation_messages add column if not exists segments jsonb not null default '[]'::jsonb
  check (jsonb_typeof(segments) = 'array');
alter table public.conversation_messages add column if not exists response_kind text not null default 'normal'
  check (response_kind in ('normal', 'fallback', 'abstained'));
-- Existing browser policies were workspace-wide; chat history belongs to its author.
alter policy "Workspace members view conversations" on public.conversations
  using (created_by = auth.uid() and public.is_workspace_member(workspace_id));
alter policy "Workspace members view messages" on public.conversation_messages
  using (exists (select 1 from public.conversations c where c.id = conversation_id
    and c.created_by = auth.uid() and public.is_workspace_member(c.workspace_id)));
create index if not exists conversation_messages_thread_order_idx
  on public.conversation_messages(conversation_id, created_at, id);
grant select, insert on public.conversations, public.conversation_messages to mill_runtime;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'conversations'
      and policyname = 'Runtime owners read conversations') then
    create policy "Runtime owners read conversations" on public.conversations for select to mill_runtime
      using (created_by = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        and public.is_workspace_member(workspace_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'conversations'
      and policyname = 'Runtime owners create conversations') then
    create policy "Runtime owners create conversations" on public.conversations for insert to mill_runtime
      with check (created_by = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        and public.is_workspace_member(workspace_id)
        and exists (select 1 from public.dataset_versions v join public.imports i on i.id = v.import_id
          where v.id = dataset_version_id and v.workspace_id = workspace_id and i.workspace_id = workspace_id
            and v.status = 'committed' and i.status = 'committed'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'conversation_messages'
      and policyname = 'Runtime owners read messages') then
    create policy "Runtime owners read messages" on public.conversation_messages for select to mill_runtime
      using (exists (select 1 from public.conversations c where c.id = conversation_id
        and c.created_by = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        and public.is_workspace_member(c.workspace_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'conversation_messages'
      and policyname = 'Runtime owners create messages') then
    create policy "Runtime owners create messages" on public.conversation_messages for insert to mill_runtime
      with check (exists (select 1 from public.conversations c where c.id = conversation_id
        and c.created_by = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        and public.is_workspace_member(c.workspace_id)));
  end if;
end $$;

create or replace function public.runtime_owns_conversation(candidate_thread text) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.conversations c
    where c.id::text = candidate_thread
      and c.created_by = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      and public.is_workspace_member(c.workspace_id));
$$;
revoke all on function public.runtime_owns_conversation(text) from public;
grant execute on function public.runtime_owns_conversation(text) to mill_runtime;

create schema if not exists chat_graph;
revoke all on schema chat_graph from public;
grant usage on schema chat_graph to mill_runtime;

-- Match the pinned PostgresSaver migration state; keep its tables outside public.
create table if not exists chat_graph.checkpoint_migrations (v integer primary key);
create table if not exists chat_graph.checkpoints (
  thread_id text not null, checkpoint_ns text not null default '', checkpoint_id text not null,
  parent_checkpoint_id text, type text, checkpoint jsonb not null, metadata jsonb not null default '{}',
  primary key (thread_id, checkpoint_ns, checkpoint_id)
);
create table if not exists chat_graph.checkpoint_blobs (
  thread_id text not null, checkpoint_ns text not null default '', channel text not null,
  version text not null, type text not null, blob bytea,
  primary key (thread_id, checkpoint_ns, channel, version)
);
create table if not exists chat_graph.checkpoint_writes (
  thread_id text not null, checkpoint_ns text not null default '', checkpoint_id text not null,
  task_id text not null, idx integer not null, channel text not null, type text,
  blob bytea not null, task_path text not null default '',
  primary key (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);
create index if not exists checkpoints_thread_id_idx on chat_graph.checkpoints(thread_id);
create index if not exists checkpoint_blobs_thread_id_idx on chat_graph.checkpoint_blobs(thread_id);
create index if not exists checkpoint_writes_thread_id_idx on chat_graph.checkpoint_writes(thread_id);
insert into chat_graph.checkpoint_migrations(v)
select generate_series(0, 9) on conflict do nothing;

alter table chat_graph.checkpoints enable row level security;
alter table chat_graph.checkpoint_blobs enable row level security;
alter table chat_graph.checkpoint_writes enable row level security;
grant select, insert, update on chat_graph.checkpoints, chat_graph.checkpoint_blobs,
  chat_graph.checkpoint_writes to mill_runtime;

do $$ declare table_name text; begin
  foreach table_name in array array['checkpoints', 'checkpoint_blobs', 'checkpoint_writes'] loop
    if not exists (select 1 from pg_policies where schemaname = 'chat_graph' and tablename = table_name
        and policyname = 'Runtime owners read chat checkpoints') then
      execute format('create policy "Runtime owners read chat checkpoints" on chat_graph.%I for select to mill_runtime using (public.runtime_owns_conversation(thread_id))', table_name);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'chat_graph' and tablename = table_name
        and policyname = 'Runtime owners create chat checkpoints') then
      execute format('create policy "Runtime owners create chat checkpoints" on chat_graph.%I for insert to mill_runtime with check (public.runtime_owns_conversation(thread_id))', table_name);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'chat_graph' and tablename = table_name
        and policyname = 'Runtime owners update chat checkpoints') then
      execute format('create policy "Runtime owners update chat checkpoints" on chat_graph.%I for update to mill_runtime using (public.runtime_owns_conversation(thread_id)) with check (public.runtime_owns_conversation(thread_id))', table_name);
    end if;
  end loop;
end $$;
