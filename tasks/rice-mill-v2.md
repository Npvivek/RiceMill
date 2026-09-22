# Rice Mill v2 implementation handoff

**Source of truth:** [backend, dashboard, and AI implementation spec](../specs/ai-backend-and-dashboard.md)

**Implementation branch:** `codex/ai-backend-foundation` (until merged into `main`).

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

## Pending: Milestone B completion

- [ ] Connect workspace authorization to `workspaces` and `workspace_members`; do not trust a caller-supplied workspace or user ID.
- [ ] Add a restricted Postgres runtime connection and enforce equivalent workspace access for direct SQL and graph checkpoints.
- [ ] Generate and consume TypeScript types from the FastAPI OpenAPI contract.

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

- [ ] Merge this branch into the Git branch configured as Vercel's production branch (normally `main`), then verify the Vercel production deployment.
- [ ] Verify signed-in, signed-out, expired-session, slow-network, cold/warm dashboard navigation with production builds. Collect at least 20 samples per relevant scenario before claiming the p95 target.
- [ ] Recheck Render/Supabase free-tier limits and run an export/restore drill before relying on hosted business data.

## Explicitly deferred

- [ ] Any external-model provider, including OpenRouter and Jev. A separate spec, benchmark, privacy review, latency/error-state design, and explicit budget are required before adding one.

## Working rules

- Keep the existing browser-only report flow live while v2 imports are built.
- Never infer or merge historical workbooks automatically; require an explicit review/replace decision.
- Treat workbook text as untrusted data and keep money calculations deterministic with `Decimal`.
- Do not mark a pending item complete until it has implementation evidence and appropriate tests.
