-- Milestone C uses the existing restricted role. The service supplies the
-- verified JWT subject with SET LOCAL for every transaction.
grant select, insert, update on public.imports, public.dataset_versions,
  public.source_rows, public.transactions to mill_runtime;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'imports'
      and policyname = 'Runtime members read imports') then
    create policy "Runtime members read imports" on public.imports for select to mill_runtime
      using (public.is_workspace_member(workspace_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'imports'
      and policyname = 'Runtime members insert imports') then
    create policy "Runtime members insert imports" on public.imports for insert to mill_runtime
      with check (
        public.is_workspace_member(workspace_id)
        and uploaded_by = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        and split_part(storage_path, '/', 1) = workspace_id::text
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'imports'
      and policyname = 'Runtime uploaders update imports') then
    create policy "Runtime uploaders update imports" on public.imports for update to mill_runtime
      using (public.is_workspace_member(workspace_id)
        and uploaded_by = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid)
      with check (public.is_workspace_member(workspace_id)
        and uploaded_by = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        and split_part(storage_path, '/', 1) = workspace_id::text);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dataset_versions'
      and policyname = 'Runtime members read versions') then
    create policy "Runtime members read versions" on public.dataset_versions for select to mill_runtime
      using (public.is_workspace_member(workspace_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dataset_versions'
      and policyname = 'Runtime members insert versions') then
    create policy "Runtime members insert versions" on public.dataset_versions for insert to mill_runtime
      with check (
        public.is_workspace_member(workspace_id)
        and created_by = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        and exists (select 1 from public.imports i where i.id = import_id and i.workspace_id = workspace_id)
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'source_rows'
      and policyname = 'Runtime members read source rows') then
    create policy "Runtime members read source rows" on public.source_rows for select to mill_runtime
      using (exists (select 1 from public.dataset_versions v
        where v.id = dataset_version_id and public.is_workspace_member(v.workspace_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'source_rows'
      and policyname = 'Runtime members insert source rows') then
    create policy "Runtime members insert source rows" on public.source_rows for insert to mill_runtime
      with check (exists (select 1 from public.dataset_versions v
        where v.id = dataset_version_id and public.is_workspace_member(v.workspace_id)));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions'
      and policyname = 'Runtime members read transactions') then
    create policy "Runtime members read transactions" on public.transactions for select to mill_runtime
      using (public.is_workspace_member(workspace_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions'
      and policyname = 'Runtime members insert transactions') then
    create policy "Runtime members insert transactions" on public.transactions for insert to mill_runtime
      with check (
        public.is_workspace_member(workspace_id)
        and exists (select 1 from public.dataset_versions v
          where v.id = dataset_version_id and v.workspace_id = workspace_id)
        and exists (select 1 from public.source_rows s
          where s.id = source_row_id and s.dataset_version_id = dataset_version_id)
      );
  end if;
end $$;
