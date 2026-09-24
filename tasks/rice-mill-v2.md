# Rice mill v2 handoff

**Source of truth:** [implementation spec](../specs/ai-backend-and-dashboard.md).

**Status:** Milestones A and B are deployed. [Milestone C PR #4](https://github.com/Npvivek/RiceMill/pull/4) merged into `main` as `90ef585` on 2026-09-24. Its hosted import flow passed a synthetic upload, duplicate retry, and persisted read; that fixture was removed. [Milestone D PR #6](https://github.com/Npvivek/RiceMill/pull/6) merged as `5bb7645`. Render and Vercel serve that commit, the D runtime migration is applied, and hosted synthetic insights, cancellation, restart, and cold wake passed. The isolated RLS, evaluation, and backup/restore gates below remain open; do not rely on findings for family decisions yet.

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

## Milestone C — scoped import (deployed and verified with synthetic data)

- [x] Add authenticated `.xlsx` upload, server-recomputed hash, private Storage path, and same-hash idempotency.
- [x] Parse deterministically with bounded ZIP/row limits and `Decimal` money; reject ambiguity or invalid transaction fields. Keep source coordinates and excluded-row reasons.
- [x] Commit one dataset version, source rows, transactions, and final import status atomically; expose paginated import and transaction reads through `/v2/imports` and `/import`.
- [x] Add synthetic tests for refunds, formula cells, Telugu/English text, duplicate totals, invalid dates, overlapping workbooks, idempotency, rollback, and the three routes.
- [x] Apply the additive C runtime-access migration and configure Storage upload on the hosted backend. Verify upload → parse → view with synthetic data before family workbooks.

**Hosted verification (2026-09-24):** The additive runtime-access SQL completed in Supabase SQL Editor. Render has the Storage publishable-key setting; Vercel has the public v2 API URL for Production and Preview. `/health/live` and `/health/ready` returned 200, and unauthenticated `/v2/imports` returned 401. A newly provisioned workspace owner uploaded a synthetic `.xlsx`: the app displayed 2 transactions, income ₹75.00, and expense ₹50.00. A repeat upload returned the existing import. After reload, the record remained visible; SQL showed 1 import, 1 version, 3 source rows, 2 transactions, and 1 private Storage object. The synthetic object and linked rows were then removed, and all five counts returned to zero. Only the signed-in owner has been provisioned; add the second family user separately after confirming their account. The older branch preview was not redeployed and its origin is not in Render's CORS allowlist; Production is the verified path.

**Scope decision:** [Simplified C](../specs/decisions.md#2026-09-24--simplified-milestone-c-import) supersedes the earlier composite-FK plan for this milestone. Composite FKs, `mapping_rules`, review workflows, and stale-output markers are deferred indefinitely. Ambiguous workbooks fail with a clear error; they are never partially committed. Existing browser reports remain live.

## Milestone D — deterministic analysis

- [x] Add seven bounded read-only tools against membership-scoped committed datasets, using Decimal money and capped results.
- [x] Implement four deterministic LangGraph stages, structured evidence validation, persisted tool results/findings, leases, retries, cancellation, stage checkpoints, and 30-day terminal-checkpoint pruning.
- [x] Add four authenticated run routes, generated API types, and the committed-import insights panel with transaction evidence navigation.
- [x] Add synthetic tool, graph, recovery, and route tests; extend the opt-in live RLS test to runs, tool results, findings, and checkpoints. Local lint, type, test, build, and API-drift checks passed (53 tests passed; one live RLS test skipped without test DB credentials).
- [x] Apply [the additive D runtime-access migration](../supabase/migrations/202609240003_analysis_runtime_access.sql#L3) in live Supabase SQL Editor after a privilege audit. The intended grants and seven RLS policies were present afterward; C import permissions were unchanged.
- [x] Verify [Render deployment `dep-daq6i8142hec73bnonig`](https://dashboard.render.com/web/srv-dapc3j0473hc738v4mq0/deploys/dep-daq6i8142hec73bnonig) and [Vercel Production deployment `2wBKP7dnT`](https://vercel.com/npviveks-projects/rice-mill/2wBKP7dnTxzfsqeubdmJATxatc5T) at `5bb7645`.
- [x] Upload a synthetic workbook and generate hosted insights: four committed transactions, two findings, five evidence references, and zero missing or cross-version transaction targets. A separate 6,000-transaction synthetic run was cancelled; the database recorded `cancelled` with zero findings.
- [x] Restart the Render service through its dashboard. Logs showed a new server process at 16:43:47 IST; `/health/live` and `/health/ready` returned 200 afterward, and completed findings remained visible after reload.
- [x] Observe the import page's delayed-backend state after inactivity: it displayed “The server is taking longer than usual” after eight seconds. Render logs showed a new process at 17:00:29 IST; the duplicate import and persisted insights loaded afterward.
- [x] Remove both synthetic workbooks and linked database fixtures. Supabase confirmed deletion of two storage objects; the fixture-only SQL cleanup succeeded. A read-only audit returned zero matching imports, dataset versions, analysis runs, and storage objects. Dependent findings, tool results, and checkpoints cascade with their runs.
- [ ] Run the opt-in two-workspace D RLS test against an isolated database. Separate test credentials were not provided; do not run it against the live project.
- [ ] Complete the 20-question business evaluation and backup/restore drill before relying on findings for family decisions.

**D deployment gate:** Production code, runtime permissions, synthetic insights, evidence linkage, cancellation, process restart, cold wake, and fixture cleanup have been observed. The isolated RLS test, 20-question human review, and backup/restore drill remain open. The requested four-route limit makes repeat POST on an expired run the explicit resume action; [the decision log](../specs/decisions.md#2026-09-24--bounded-analysis-state-and-recovery) records the tradeoff. `waiting_review` remains unused because strict C import rejects ambiguous workbooks, and this D release has no review action.

**Deferred:** any external model provider, including OpenRouter and Jev, needs a separate spec, benchmark, privacy review, error design, and budget. Keep the browser-only reports live during v2 import work; never merge historical workbooks without review.
