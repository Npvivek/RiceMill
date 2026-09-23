-- Keep staged and committed originals in private Storage. Milestone C will
-- define a separate, narrowly scoped cleanup path for abandoned uploads.
alter policy "Workspace members remove workbooks" on storage.objects
  using (false);
