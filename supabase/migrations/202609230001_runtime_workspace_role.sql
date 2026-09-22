-- Apply with the migration/admin connection. Set a random mill_runtime password
-- separately; never put the password or migration URL in source control.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'mill_runtime') then
    create role mill_runtime login nobypassrls nocreatedb nocreaterole noinherit;
  end if;
end $$;
alter role mill_runtime login nobypassrls nocreatedb nocreaterole noinherit;
grant usage on schema public to mill_runtime;
grant usage on schema auth to mill_runtime;
grant execute on function auth.uid() to mill_runtime;
grant execute on function public.is_workspace_member(uuid) to mill_runtime;

-- The current foundation reads memberships and run ownership and writes only
-- checkpoints. Future write paths must add narrowly scoped grants and policies.
grant select on public.workspaces, public.workspace_members, public.analysis_runs,
  public.graph_checkpoints to mill_runtime;
grant insert, update on public.graph_checkpoints to mill_runtime;

create policy "Runtime members view workspaces" on public.workspaces
  for select to mill_runtime using (public.is_workspace_member(id));
create policy "Runtime members view memberships" on public.workspace_members
  for select to mill_runtime using (user_id = auth.uid());
create policy "Runtime members view analysis" on public.analysis_runs
  for select to mill_runtime using (public.is_workspace_member(workspace_id));
create policy "Runtime members view checkpoints" on public.graph_checkpoints
  for select to mill_runtime using (
    exists (select 1 from public.analysis_runs r
      where r.id = analysis_run_id and public.is_workspace_member(r.workspace_id))
  );
create policy "Runtime members write checkpoints" on public.graph_checkpoints
  for insert to mill_runtime with check (
    exists (select 1 from public.analysis_runs r
      where r.id = analysis_run_id and public.is_workspace_member(r.workspace_id))
  );
create policy "Runtime members update checkpoints" on public.graph_checkpoints
  for update to mill_runtime using (
    exists (select 1 from public.analysis_runs r
      where r.id = analysis_run_id and public.is_workspace_member(r.workspace_id))
  ) with check (
    exists (select 1 from public.analysis_runs r
      where r.id = analysis_run_id and public.is_workspace_member(r.workspace_id))
  );
