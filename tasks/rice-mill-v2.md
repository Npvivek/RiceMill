# Rice mill v2 handoff

**Source of truth:** [implementation spec](../specs/ai-backend-and-dashboard.md) (unchanged).

**Status:** [PR #2](https://github.com/Npvivek/RiceMill/pull/2) merged into `main` as `5cc4e60` on 2026-09-23. Vercel Production succeeded; Render tracks `main` and deployed `dep-dapeqt8473hc73982v30`. The live frontend, `/health/live`, and `/health/ready` returned HTTP 200. Milestone B code is deployed; credential rotation remains open.

## Done

- [x] Milestone A: dashboard navigation feedback, duplicate-auth-read removal, report pagination, and lazy workbook/PDF loading.
- [x] Milestone B: Supabase JWT validation; membership-based workspace access; restricted `mill_runtime` database sessions and RLS; ownership-scoped direct SQL and LangGraph checkpoints; generated OpenAPI TypeScript client and drift check.
- [x] Apply additive workspace and runtime-role migrations. The v2 service uses the Supabase session pooler on port 5432; migration credentials stay outside the request path.
- [x] Deploy the deterministic LangGraph shell without external models. Remove legacy backend scaffolding and unused frontend files; update setup docs.
- [x] Test authorization, spoofing, and token rejection. A live two-workspace probe denied foreign reads/writes and checkpoint access, confirmed pooled-claim reset, and removed its synthetic rows. Render `/health/ready` returned 200 before and after a real service restart (`dep-dapdokss728c73ehd1kg`).
- [x] Cleanup checks: Ruff pass; mypy pass (16 files); pytest 17 passed, 1 opt-in live test skipped; frontend lint/build and API contract check passed. Render built the cleanup image (`dep-dapelv2jnfac738706b0`) and returned 200 from both health endpoints. No local Docker/Podman was available.

## Open before relying on hosted business data

- [ ] Rotate the short `mill_runtime` password in Supabase and update Render's `RUNTIME_DATABASE_URL`. The owner deferred this; never put the password in Git or chat.
- [ ] Automate the live RLS test when an isolated admin test URL is available. The manual live probe above supplies current isolation evidence; never put admin credentials on Render.
- [ ] Test dashboard navigation across signed-in/out, expired-session, slow-network, and cold/warm paths. Collect at least 20 samples per relevant scenario before claiming a p95 target.
- [ ] Recheck Render/Supabase limits and complete an export/restore drill.

## Milestone C — canonical import

- [ ] Stage authenticated `.xlsx` uploads in private Storage; verify uploader, ownership, and file hash.
- [ ] Parse safely; require review for ambiguous sheets, columns, dates, directions, totals, and exclusions.
- [ ] Commit immutable, versioned datasets with `Decimal` reconciliation, source coordinates, mapping version, and idempotent same-hash imports.
- [ ] Add paginated transactions, mapping corrections, and fixtures for refunds, stale formulas, Telugu/English descriptions, duplicate totals, invalid dates, and overlapping workbooks.

## Milestone D — deterministic analysis

- [ ] Add bounded read-only tools against canonical datasets.
- [ ] Persist runs, validated findings, evidence, progress, leases, retries, cancellation, and resumable checkpoints.
- [ ] Complete deterministic LangGraph stages and frontend import/review/dataset/run/evidence views.
- [ ] Test recovery, authorization, RLS, backup/restore, and analysis evaluation.

**Deferred:** any external model provider, including OpenRouter and Jev, needs a separate spec, benchmark, privacy review, error design, and budget. Keep the browser-only reports live during v2 import work; never merge historical workbooks without review.
