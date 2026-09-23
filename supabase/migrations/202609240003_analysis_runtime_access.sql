-- Apply with migration credentials after the C runtime migration. No live apply in this task.
-- The request path still uses only mill_runtime and a transaction-local validated JWT subject.
grant select, insert, update on public.analysis_runs to mill_runtime;
grant select, insert on public.tool_results, public.findings to mill_runtime;
grant delete on public.graph_checkpoints to mill_runtime;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'analysis_runs'
      and policyname = 'Runtime members create analysis') then
    create policy "Runtime members create analysis" on public.analysis_runs for insert to mill_runtime
      with check (public.is_workspace_member(workspace_id)
        and requested_by = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        and exists (select 1 from public.dataset_versions v
          where v.id = dataset_version_id and v.workspace_id = workspace_id and v.status = 'committed'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'analysis_runs'
      and policyname = 'Runtime members update analysis') then
    create policy "Runtime members update analysis" on public.analysis_runs for update to mill_runtime
      using (public.is_workspace_member(workspace_id))
      with check (public.is_workspace_member(workspace_id)
        and exists (select 1 from public.dataset_versions v
          where v.id = dataset_version_id and v.workspace_id = workspace_id and v.status = 'committed'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tool_results'
      and policyname = 'Runtime members read tool results') then
    create policy "Runtime members read tool results" on public.tool_results for select to mill_runtime
      using (exists (select 1 from public.analysis_runs r where r.id = analysis_run_id
        and public.is_workspace_member(r.workspace_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tool_results'
      and policyname = 'Runtime members insert tool results') then
    create policy "Runtime members insert tool results" on public.tool_results for insert to mill_runtime
      with check (exists (select 1 from public.analysis_runs r where r.id = analysis_run_id
        and public.is_workspace_member(r.workspace_id) and r.status = 'running'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'findings'
      and policyname = 'Runtime members read findings') then
    create policy "Runtime members read findings" on public.findings for select to mill_runtime
      using (exists (select 1 from public.analysis_runs r where r.id = analysis_run_id
        and public.is_workspace_member(r.workspace_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'findings'
      and policyname = 'Runtime members insert findings') then
    create policy "Runtime members insert findings" on public.findings for insert to mill_runtime
      with check (exists (select 1 from public.analysis_runs r where r.id = analysis_run_id
        and public.is_workspace_member(r.workspace_id) and r.status = 'running'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'graph_checkpoints'
      and policyname = 'Runtime prune old terminal checkpoints') then
    create policy "Runtime prune old terminal checkpoints" on public.graph_checkpoints for delete to mill_runtime
      using (exists (select 1 from public.analysis_runs r where r.id = analysis_run_id
        and public.is_workspace_member(r.workspace_id)
        and r.status in ('completed', 'partial', 'failed', 'cancelled')
        and r.completed_at < now() - interval '30 days'));
  end if;
end $$;
