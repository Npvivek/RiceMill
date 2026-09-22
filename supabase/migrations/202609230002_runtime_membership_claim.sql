-- Supabase's SQL Editor postgres role cannot grant USAGE on the auth schema.
-- Match auth.uid()'s JWT subject lookup without requiring that schema grant
-- for the restricted runtime role. The API sets this claim from a verified JWT
-- with SET LOCAL inside each request transaction.
alter policy "Runtime members view memberships" on public.workspace_members
  using (user_id = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid);
