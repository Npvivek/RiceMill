# Rice mill backend, AI analysis, and dashboard implementation spec

Date: 2026-09-22
Updated: 2026-09-23
Status: behavior spec. See the [active handoff](../tasks/rice-mill-v2.md) for progress and the [dated recon](../tasks/rice-mill-v2-recon-2026-09-23.md) for code evidence. No purchases authorized.

## 1. Outcome and decisions

Build a reliable accounts workspace for two users, the owner and his father, and a practical Python/AI engineering learning project.

- Frontend: existing Next.js/React application in TypeScript, deployed on Vercel.
- Backend: Python FastAPI, hosted as a Docker web service on Render initially.
- Data: existing Supabase project for Auth, Postgres, and private Storage.
- AI orchestration: deterministic, tool-driven Python LangGraph with durable Postgres checkpoints.
- External models, including Jev: excluded; see §10.
- Default business workspace: both manually provisioned users can access new family-mill records. Existing account-private reports remain private until explicitly migrated.

Assumptions: occasional workbook imports; modest datasets; no requirement for unattended overnight processing or always-on availability. Revisit hosting if these assumptions change.

## 2. Verified constraints and unresolved integration details

Supabase Edge Functions use Deno/TypeScript; run Python separately [S1]. Render Free sleeps after 15 idle minutes, may take about a minute to wake, and has ephemeral local storage [S2]. Keep dashboard shell/history independent of Python; show a backend-starting state for imports and analysis. Do not send keep-alive traffic. Upgrade hosting if wake time becomes unacceptable.

Supabase Free listed 500 MB database storage, 1 GB file storage, possible inactivity pauses, and no automatic backups when checked on 2026-09-22 [S3]. Retain original workbooks and test export/restore. Recheck limits before relying on hosted data.

## 3. Repository state

See the [2026-09-23 recon](../tasks/rice-mill-v2-recon-2026-09-23.md) for dated code findings. Verify changed code before acting on that snapshot.

## 4. Architecture

```text
TypeScript / Next.js on Vercel
  |-- Supabase Auth: login and existing sessions
  |-- Supabase RLS reads: dashboard shell and paginated saved reports
  |-- private Storage upload: workbook staging
  `-- authenticated HTTPS API: import, correction, analysis, chat
          |
Python / FastAPI on Render
  |-- Supabase JWT validation and workspace authorization
  |-- openpyxl parser + Pydantic validation + Decimal arithmetic
  |-- deterministic SQL/Python analysis tools
  |-- LangGraph: plan -> tools -> findings -> validation
  `-- Postgres: canonical records, jobs, evidence, checkpoints
```

Use one Python web service initially. No Redis, Celery, vector database, or separate worker is required for this bounded first release. Run one Uvicorn worker initially; durable job ownership is still enforced in Postgres. Separate a worker later if unattended execution becomes a requirement.

## 5. Milestone A: navigation feedback and performance

### Required interaction

- On an ordinary Mill Dashboard activation, immediately change the control to a spinner and `Opening dashboard…`, with an accessible polite status announcement and busy state.
- Suppress repeated ordinary activations while navigation is pending. Preserve link semantics, keyboard access, and modified/new-tab clicks; avoid nested interactive elements.
- Do not claim `Logging in` until a sign-in is actually occurring. A valid session should continue to open the dashboard without asking for credentials again.
- Show a dashboard loading skeleton during route work. The originating control must show feedback even while proxy/layout auth is unresolved; a route loading file alone is insufficient.
- After 8 seconds, show `This is taking longer than expected…`; after 30 seconds, offer a recoverable retry/open-login action. Do not leave a permanent disabled control after failure or back navigation.
- Signed-out/expired-invalid sessions reach login; valid sessions reach dashboard; refreshable sessions recover correctly. Preserve refreshed cookies on redirects.
- Saved reports render independently of the Python backend and AI availability. Show separate report-loading, server-starting, and analysis-running states.

### Measurement and optimization

- Read `frontend/AGENTS.md` and bundled Next.js version documentation before implementation.
- Instrument click-to-feedback, click-to-shell, auth verification, history fetch, and JS loading separately. Use request IDs and performance timings without tokens or financial content.
- Measure signed-in, signed-out, expired session, slow network, and cold/warm navigation in a production build.
- Evaluate repeated auth checks and framework-supported JWT verification/caching within the same request. Remove redundant work only after verifying equivalent authorization, refresh, and revocation behavior; never trust an unsigned cookie or reuse one user's auth result across requests.
- Paginate history (initial page 20 records) and add matching access/filter/order indexes.
- Inspect bundle composition; lazy-load Excel/PDF code when used if it contributes to navigation cost. Do not preload all report contents.
- Use prefetch only where compatible with auth freshness and the installed Next.js version.

Acceptance: feedback within 100 ms of an ordinary click on the tested device; repeated clicks cause one navigation; keyboard/screen-reader status works; delayed auth is visibly pending; all session paths remain correct. Target warm click-to-shell p95 below 2 seconds under documented test conditions, with at least 20 samples per relevant scenario. Report actual results and blockers rather than claiming the target is guaranteed. Cold Python startup must not delay opening the dashboard.

## 6. Milestone B: Python foundation and authorization

- Refactor `backend/` into the supported v2 service; preserve unrelated legacy code but do not mount its auth/business routers by default.
- Replace custom user/password/JWT authentication with Supabase access-token validation. Validate signature, expiry, issuer, and expected audience against the project's supported signing configuration; cache JWKS safely and handle key rotation. Fail closed.
- Resolve user identity from the token and workspace access from membership records, never from submitted user IDs.
- Use a restricted database role and transaction-local authenticated claims/RLS where applicable. Direct SQL and checkpoint access must enforce equivalent workspace ownership; a privileged connection does not automatically apply browser RLS. Avoid service-role access for normal request reads/writes.
- Keep database credentials server-side. Exact CORS allowlist for production and localhost; no wildcard authenticated origins.
- Use Supabase SQL migrations as the single migration authority, including graph checkpoint schema migrations. Remove startup table creation. Separate runtime and migration credentials.
- Use SQLAlchemy/psycopg with a small bounded pool. Choose a Supabase connection/pooler mode compatible with both ORM transactions and LangGraph checkpoint requirements; prove connection/restart behavior in the deployment spike.
- Expose generated OpenAPI contracts and generate TypeScript client types to avoid handwritten duplicate schemas.

Use Pydantic settings, locked dependencies, Ruff, pytest, and a type checker.

## 7. Milestone C: canonical import and storage

Python becomes the authoritative parser and calculator. Browser preview is optional; do not maintain competing authoritative parsers long term.

Initial import caps: 10 MB compressed workbook, 100 MB expanded archive, 50 sheets, and 100,000 populated rows per workbook. These are protective defaults to benchmark and revise, not known workload limits. Accept `.xlsx`; inspect content and ZIP expansion limits, reject encrypted/unsupported inputs, and never execute macros or formulas.

Flow: authenticated staging upload -> backend confirms ownership/hash -> parse -> review mappings and exclusions -> commit immutable dataset version -> calculate baseline report. Store temporary files only for the request/job lifetime and always clean them up; durable originals live in private Storage.

- Preserve sheet/row coordinates, relevant raw cell values, selected columns, mapping version, and every exclusion reason.
- Handle debit/credit columns, mixed sheets, refunds/negative amounts, date formats, Excel dates, merged/blank repeated labels, totals, and multiple tables through explicit rules. Ambiguous interpretations enter review rather than silently guessing.
- Formula cached values can be stale or absent: detect and flag; do not imply server recalculation.
- Support Telugu/English descriptions without destructive ASCII-only normalization.
- Use `numeric(18,2)`/Decimal for money; date-only transaction dates and UTC timestamps; display dates in Asia/Kolkata. Quantities retain units and appropriate decimal precision.
- Distinguish cash receipts/payments from balances, transfers, invoices, and advances. Avoid double-counting summary/detail sheets. Net cash flow must never be labeled profit.
- Same workbook hash within a workspace is idempotent. Changed/overlapping workbooks require explicit replace-version versus independent-dataset selection. Never add historical imports together blindly.
- Corrections produce a new dataset version and stale marker on old AI outputs. Originals remain immutable; saved reports remain reproducible.

Core tables:

| Table | Purpose |
|---|---|
| workspaces, workspace_members | Family workspace and manually provisioned memberships |
| imports | Uploader, hash, private object path, status, parser version, limits/metadata |
| dataset_versions | Immutable committed versions and replacement lineage |
| source_rows | Source coordinates, necessary raw values, parsing/review outcomes |
| transactions | Version, source reference, date, description, direction, amount, category, optional party/quantity/unit |
| mapping_rules, corrections | Reviewed reusable mappings and audit history |
| analysis_runs | State, dataset version, budgets, lease, attempts, versions, errors and timing |
| findings, tool_results | Structured claims and immutable supporting evidence |
| conversations, messages | Workspace-scoped questions, answers, and pinned dataset context |
| graph checkpoints | Compact state references, isolated from browser access |

Every business record is scoped to a workspace; enforce foreign-key consistency and access policies. Checkpoint IDs are server-generated and ownership-checked, never trusted merely because the caller knows one.

Existing reports remain readable through the old path. Do not fabricate missing transactions from their summaries. Offer reimport to unlock v2 investigations. No automatic sharing of old private reports with the second user.

## 8. Milestone D: tools and LangGraph analysis

Typed, bounded, read-only tools:

- `get_data_quality(version_id)`
- `summarize_cash_flow(version_id, date_range)`
- `compare_periods(version_id, baseline_range, comparison_range)`
- `breakdown_by_category(version_id, date_range)`
- `get_transactions(version_id, filters, cursor, limit)`
- `find_duplicate_candidates(version_id)`
- `find_unusual_entries(version_id, method_parameters)`

Code enforces authorization, date/filter validity, pagination, and result-size limits. Analysis stages cannot run arbitrary SQL, Python, or write financial records. Percentage changes with a zero baseline return undefined with an explanation. Compare equivalent periods and flag incomplete months or insufficient samples.

Graph:

```text
load version -> assess quality -> compute baseline
  -> select bounded investigation -> execute tools
  -> enough evidence? (at most 2 investigation rounds)
  -> draft structured findings -> validate evidence/numbers
  -> persist complete or partial report
```

Initial per-run budget: maximum 8 tool calls and 180 seconds of active execution. Enforce limits in code. One active run per dataset/version/prompt configuration; repeated requests return its ID. Start analysis explicitly with `Generate insights`, not on upload/open.

Findings contract: `id`, `type` (observation/hypothesis/data_quality), `title`, `explanation`, `metric_refs`, `source_refs`, `limitations`, `suggested_check`, `severity`. Bind displayed numeric values to validated metric records. Validate source IDs and dataset membership; schema validity alone does not prove the prose. Reject unsupported numerical claims and distinguish observed contributors from inferred causes. Do not claim a general numeric confidence score is calibrated.

Workbook text is untrusted data, never executable instructions. Store and process only the data necessary for the selected analysis; update current claims that workbooks never leave the device when server imports ship.

## 9. Durable execution without an always-on worker

Persist the job before returning HTTP 202. States: queued, running, waiting_review, completed, partial, failed, cancelled. Store stage/progress separately.

Use an atomic Postgres lease with expiry and heartbeat to claim a run. Execute bounded background work while the web process is alive, checkpoint between graph nodes, and persist tool outputs before subsequent generation. This is resumable execution, not a guarantee that a sleeping free service runs unattended.

The frontend polls authenticated run status with backoff. An explicit resume endpoint reclaims expired leases when the user returns; guard against simultaneous resumes. Record attempts and cap retries.

Cancellation stops scheduling new nodes and discards late responses when appropriate. Membership and dataset ownership are rechecked on resume. Never auto-resume against a corrected/new dataset version. Prune expired checkpoint payloads under a documented retention policy while retaining final reports and compact audit metadata.

## 10. Deterministic operation

The release uses deterministic, reviewed rules and bounded read-only tools. It must calculate totals from canonical records, preserve evidence, and abstain when the data is incomplete or ambiguous.

Jev and all external model providers are excluded. No provider keys, adapters, quotas, price checks, or model-specific fallback logic belong in this release. Any future provider needs a separate spec defining the decision it improves, a benchmark on sanitized fixtures, privacy handling, latency, error states, and a budget.

## 11. API contract outline

All `/v2` business endpoints require Supabase authorization and workspace membership. Mutation endpoints support idempotency keys and version checks.

| Endpoint | Result |
|---|---|
| GET /health/live; GET /health/ready | Process health; bounded dependency readiness |
| POST /v2/imports | Create scoped upload/import record and constrained upload destination |
| POST /v2/imports/{id}/parse | Start durable parse/review job; return 202 and job ID |
| GET /v2/imports/{id} | Status, review issues, preview |
| POST /v2/imports/{id}/commit | Apply reviewed mapping and commit immutable dataset version |
| GET /v2/datasets/{version}/transactions | Paginated scoped ledger |
| POST /v2/datasets/{version}/corrections | Create corrected version; require expected version |
| POST /v2/analysis-runs | Start or reuse run for a dataset version |
| GET /v2/analysis-runs/{id} | Stage, progress, findings or recoverable error |
| POST /v2/analysis-runs/{id}/resume; /cancel | Authorized resumption/cancellation |
| POST /v2/conversations; /v2/conversations/{id}/messages | Dataset-bound conversational investigation |

Common errors: code, safe message, retryable flag, request ID. Do not expose SQL, secrets, raw prompts, or other users' existence. Validate Storage ownership on parse, not just when issuing the upload destination.

## 12. Tests and release gates

- Navigation: click feedback, repeated click, new-tab behavior, keyboard, back navigation, auth delay/failure, expired/valid/no session; production-build timings.
- Import: reviewed fixtures covering mixed sheets, duplicate totals, invalid dates, refunds, formula caches, non-English descriptions, repeated uploads, overlap, and exact Decimal reconciliation.
- Access: both authorized family users can access new shared records; a third user cannot read/write another workspace, its Storage objects, jobs, checkpoints, or chat. Legacy private reports remain private.
- Analysis: metric/source references resolve; missing-data answers abstain; cash flow is not called profit; zero baselines and incomplete periods are handled.
- Recovery: terminate Python mid-run and resume; simultaneous starts/resumes do not duplicate committed findings; cancellation and cold start have useful states.
- Evaluation: at least 20 reviewed business questions plus parser fixtures; all expected arithmetic/reference checks pass. Human review confirms explanations add useful evidence rather than restating totals.
- CI: Python lint/types/tests, frontend lint/build, generated API schema consistency, migration and RLS integration tests. Use synthetic/sanitized fixtures in Git; no family workbooks or keys.
- Backup: perform one export and restore test before relying on hosted data.

## 13. Execution order and deployment

1. A: navigation feedback, auth profiling, history pagination; release independently.
2. B: Python health/auth/OpenAPI service deployed; verify cold-start behavior and DB/checkpoint connection compatibility.
3. C: server import, review, canonical ledger; compare against reviewed workbook totals before switching imports.
4. D: deterministic tools and LangGraph report, durable run recovery, evidence UI.
5. Conversational analysis using the same tested tools.

Deliver Docker and Render deployment configuration, `.env.example` without secrets, local setup instructions, migrations, backup/restore steps, generated TypeScript contracts, and evaluation commands. Configure frontend origin, backend URL, Supabase project/JWKS details, restricted database URL, and Storage settings through environment settings.

Before deployment, check current frontend hosting terms for this family-business use and measure the nearest suitable Python/Supabase regions. Free hosting eligibility and resource limits are deployment checks, not assumptions to conceal.

Roll out behind feature flags for v2 imports and AI; retain old report rendering. Use additive migrations first. A rollback disables new entry points and preserves committed data; do not drop new tables or overwrite old reports during initial rollout.

Not in this release: automatic business transactions, autonomous supplier outreach, production forecasting without appropriate data, inventory valuation/profit claims, vector search over numeric ledgers, multi-agent infrastructure, or a mandatory paid model.

## Sources checked 2026-09-22

- S1: https://supabase.com/docs/guides/functions/quickstart
- S2: https://render.com/docs/free
- S3: https://supabase.com/pricing
- LangGraph architecture/persistence background: https://docs.langchain.com/oss/javascript/langgraph/overview (conceptual reference; verify Python APIs against current Python documentation during implementation).
