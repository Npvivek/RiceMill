# Rice Mill v2 implementation handoff

**Source of truth:** [backend, dashboard, and AI implementation spec](../specs/ai-backend-and-dashboard.md)

**Release:** [PR #1](https://github.com/Npvivek/RiceMill/pull/1) merged `codex/ai-backend-foundation` into `main`. Vercel marked merge commit `3d4ad7f` Ready in Production and assigned `rice-mill-steel.vercel.app` on 2026-09-23.

**Milestone B branch:** [PR #2](https://github.com/Npvivek/RiceMill/pull/2) is a draft against `main`. Its authorization implementation was verified at `b75aff0`, and the legacy cleanup was added at `6f22099`. It is not merged into the production branch. Do not call Milestone B released until the pending items below are resolved.

## Completed

- [x] Write and store the implementation spec.
- [x] Apply the additive Supabase migration for workspaces, imports, datasets, analysis runs, findings, conversations, and checkpoints.
- [x] Add the Python/FastAPI v2 foundation: live/ready health endpoints, Supabase JWT validation, restricted CORS, and disabled production docs.
- [x] Deploy the Python service to Render and verify `GET /health/live`.
- [x] Add a bounded deterministic LangGraph workflow shell. It has no external-model calls.
- [x] Remove OpenRouter and Jev source code, settings, dependencies, and deployment configuration.
- [x] Improve dashboard navigation: immediate pending feedback, repeated-click suppression, delayed-state messaging, route loading skeleton, and navigation timings.
- [x] Remove the duplicate dashboard authentication read while retaining proxy verification.
- [x] Paginate saved report history and lazy-load workbook/PDF libraries only when used.
- [x] Run backend lint/tests and frontend lint/build before the last implementation commit.

## Milestone B implementation on PR #2

- [x] Resolve identity from validated Supabase JWTs and workspace access from `workspace_members`; deny requests for other workspaces. Unit tests cover spoofed IDs and invalid token audience, issuer, and expiry.
- [x] Use restricted `mill_runtime` SQLAlchemy sessions and membership-scoped direct SQL and LangGraph checkpoints. Additive RLS migrations were applied. A manual live probe with two synthetic workspaces tested foreign read/write denial, checkpoint access, and pooled-claim reset; all synthetic rows were removed. The opt-in pytest live integration test remains skipped locally without an admin DSN.
- [x] Commit the FastAPI OpenAPI schema and generated TypeScript client/types, with a contract-drift check. The browser report workflow does not call the v2 API yet.
- [x] Verify the Render session pooler on port 5432 across an actual service restart: deploy `dep-dapdokss728c73ehd1kg` returned HTTP 200 from `/health/ready` before and after the restart on 2026-09-23.
- [x] Run Ruff, mypy (16 files), pytest (17 passed, 1 opt-in live test skipped), frontend ESLint/build, and the OpenAPI drift check on PR #2 before this cleanup.

## Pending: Milestone B release

- [ ] Rotate the short `mill_runtime` database password in Supabase and update only Render's `RUNTIME_DATABASE_URL` secret. The owner deferred this step; do not record the password in Git or chat.
- [ ] Review and merge PR #2 into `main`, then verify Vercel production and Render's deployed branch/commit and readiness endpoint.
- [ ] Automate the live RLS integration test when an isolated admin-only test URL is available. The current branch has manual live isolation evidence; never put migration credentials on the web service.

## Pending: Milestone C — canonical import

- [ ] Build authenticated workbook staging uploads to private Supabase Storage.
- [ ] Verify uploader ownership and file hash before parsing.
- [ ] Implement protected `.xlsx` parsing and explicit review states for ambiguous sheets, columns, dates, directions, totals, and exclusions.
- [ ] Commit reviewed records as immutable dataset versions with Decimal reconciliation, source coordinates, mapping version, and idempotent same-hash imports.
- [ ] Build paginated dataset transactions and versioned mapping corrections.
- [ ] Add parser fixtures for mixed sheets, refunds, stale formulas, Telugu/English descriptions, duplicate totals, invalid dates, repeated uploads, and overlapping workbooks.

## Pending: Milestone D — deterministic analysis

- [ ] Implement bounded read-only analysis tools against canonical datasets.
- [ ] Persist analysis runs, tool results, validated findings, evidence references, progress, leases, retries, cancellation, and resumable checkpoints.
- [ ] Implement the deterministic LangGraph stages using those tools; validate arithmetic and source references before saving findings.
- [ ] Add frontend import, review, dataset, run-status, and evidence views behind v2 feature flags.
- [ ] Add recovery, authorization, migration/RLS, backup/restore, and analysis evaluation tests.

## Release and deployment work

- [x] Merge PR #1 into Vercel's verified production branch (`main`) and confirm its production deployment is Ready on `rice-mill-steel.vercel.app`.
- [ ] Verify signed-in, signed-out, expired-session, slow-network, cold/warm dashboard navigation with production builds. Collect at least 20 samples per relevant scenario before claiming the p95 target.
- [ ] Recheck Render/Supabase free-tier limits and run an export/restore drill before relying on hosted business data.
- [x] Verify the cleanup locally: Ruff passed; mypy passed on 16 files; pytest passed 17 tests with 1 opt-in live test skipped; API contract check, frontend ESLint, and production build passed. The OpenAPI output is unchanged.
- [x] Verify the cleanup Docker image on Render: deploy `dep-dapelv2jnfac738706b0` built commit `6f22099`, reached Live, and returned HTTP 200 from both `/health/live` and `/health/ready` on 2026-09-23. Docker/Podman is not installed in the local shell, so no local container build was run.

## Explicitly deferred

- [ ] Any external-model provider, including OpenRouter and Jev. A separate spec, benchmark, privacy review, latency/error-state design, and explicit budget are required before adding one.

## Working rules

- Keep the existing browser-only report flow live while v2 imports are built.
- Never infer or merge historical workbooks automatically; require an explicit review/replace decision.
- Treat workbook text as untrusted data and keep money calculations deterministic with `Decimal`.
- Do not mark a pending item complete until it has implementation evidence and appropriate tests.
