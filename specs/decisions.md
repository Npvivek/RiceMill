# Decision log

Append-only. Each entry records its date, decision, reason, and alternatives considered. Add new entries below existing ones; do not rewrite past entries.

## Empty entry template

### YYYY-MM-DD — Decision title

- **Date:** YYYY-MM-DD
- **Decision:**
- **Reason:**
- **Alternatives considered:**

## 2026-09-23 — Cross-workspace integrity for C tables
Decision: Carry workspace_id through imports, dataset_versions, source_rows and transactions; enforce lineage with composite foreign keys.
Reason: Database constraints reject cross-workspace links during application, direct SQL and admin writes.
The transaction-to-source-row key includes dataset_version_id, preventing links to another dataset within the same workspace.
Accept that these constraints do not enforce review approval; the commit path must separately reject unresolved source rows.
Alternatives considered:
- Trigger-based checks: rejected for relationship equality because custom mutation coverage and locking duplicate native FK enforcement.
- RLS-only: rejected because authorization policies can be bypassed and do not inherently guarantee relational consistency.
- Exclusive database write functions: rejected as sole enforcement because privileged direct writes and function bugs can bypass their checks.

## 2026-09-24 — Simplified Milestone C import
Decision: Build one synchronous, all-or-fail workbook import using the existing four C tables; defer composite foreign keys, mapping rules, review workflows, and stale-output markers indefinitely. This supersedes the 2026-09-23 composite-FK decision for this milestone.
Reason: Two users and one workspace need a usable upload-to-ledger path now. The service validates row lineage before committing, while the existing unique hash constraint prevents duplicate imports. A privileged direct SQL write can still link rows inconsistently across workspaces; this is the accepted failure mode until database constraints are revisited.
Alternatives considered:
- Full staged review and version-correction workflow: rejected because it delays a working import path and adds states the current users cannot resolve in the app.
- Composite FKs now: rejected for this KISS scope despite their stronger protection against privileged direct writes.

## 2026-09-24 — Restricted import-table access
Decision: Keep `mill_runtime` restricted and add SELECT, INSERT, and UPDATE grants plus membership-scoped RLS policies only for the four import tables. No live migration will be applied in this milestone.
Reason: The request for write grants alone conflicts with the existing schema: the runtime role has no C-table SELECT grants or policies, and RLS would reject its writes. The three requested routes must read imports and transactions, so granting writes alone cannot produce a working flow. Parent ownership is checked in child-row policies as well as in the service.
Alternatives considered:
- Write grants without policies or SELECT: rejected because every C operation would fail under current RLS.
- Privileged or service-role reads: rejected because they bypass the established request-scoped authorization boundary.

## 2026-09-24 — Import reservation and Storage boundary
Decision: Reserve a staged import by `(workspace_id, file_hash)` in a short transaction, upload the original to private Storage with the validated user's token, parse inline, then commit all child rows and final status in one separate transaction. A duplicate returns the existing row unchanged.
Reason: The unique constraint arbitrates concurrent uploads before an object is created, and the commit transaction cannot expose a partial ledger. Supabase's gateway requires a project publishable key, so the backend needs a new public-key environment setting; no existing value is read or logged. This and pinned upload/parser dependencies are necessary exceptions to the request's path and credential wording.
Alternatives considered:
- Upload before reservation: rejected because concurrent duplicates can leave untracked objects.
- Hold one database transaction across upload and parsing: rejected because a slow Storage call or workbook would hold a pooled connection and transaction open.
- Use a service-role Storage client: rejected because it would bypass the existing Storage RLS boundary.

## 2026-09-24 — Strict deterministic workbook parsing
Decision: Use pinned openpyxl with defusedxml, ZIP expansion checks, and Decimal money; reject ambiguous financial mappings and formula-derived transaction fields instead of guessing or committing partial rows.
Reason: The browser parser's keyword, sheet, date, and category rules are useful starting points, but its single-amount-column and whole-sheet assumptions can silently misstate a ledger. Excluded summaries and total rows retain source coordinates and reasons; included descriptions retain their original Unicode.
Alternatives considered:
- Reuse browser `number` calculations as authoritative: rejected because floating-point totals and silent exclusions are unsuitable for committed transactions.
- Add an interactive review workflow: deferred by the simplified Milestone C decision.

## 2026-09-24 — Inline import API and browser states
Decision: Expose only POST and paginated GET import routes; return decimal totals as strings and use one generated OpenAPI contract in the `/import` UI. Show upload progress, parsing, delayed-server, success, and recoverable error states.
Reason: Inline parsing avoids a job system for occasional small files. A delayed-server message is based on elapsed time, not a claim that Render is certainly waking. Next.js renders the page, while FastAPI and Postgres remain the authorization boundary.
Alternatives considered:
- Separate parse, review, and commit endpoints: deferred by the simplified Milestone C decision.
- A second handwritten frontend response schema: rejected because the existing contract drift check must remain authoritative.

## 2026-09-24 — Retryable Storage failure before staging commit
Decision: Supersede the earlier reservation timing: keep the reservation transaction open only through the bounded Storage upload, then commit the staged row; parse and ledger commit still occur outside that transaction. Roll back the reservation if Storage fails.
Reason: Committing a failed reservation before Storage would permanently consume the unique file hash, making a transient upload failure impossible to retry under the no-overwrite idempotency rule. The upload is limited to 10 MB and a bounded timeout; parsing and row insertion never hold this transaction open.
Alternatives considered:
- Keep a failed row for Storage errors: rejected because an identical retry would only return that failed row.
- Grant runtime DELETE to clean failed reservations: rejected because it broadens the normal request role beyond the requested write scope.

## 2026-09-24 — Authenticate the import page at the existing proxy boundary
Decision: Include `/import` in the existing Supabase session proxy and redirect unauthenticated page requests to login, while FastAPI still validates the bearer token independently for every data request.
Reason: A client-only page would render to signed-out visitors and rely on later API errors for access feedback. The proxy already refreshes the session and supplies a verified user header; extending its path check avoids a second auth mechanism.
Alternatives considered:
- Check auth only in the client component: rejected because it shows the form before discovering a missing or expired session.
- Duplicate `auth.getUser()` in a new server layout: rejected because the proxy already performs that verification.

## 2026-09-24 — Stable OpenAPI error descriptions across Python versions
Decision: Specify the import route's 413 and 422 response descriptions explicitly in FastAPI metadata.
Reason: Python 3.12 and 3.14 give those HTTP codes different default phrases, so the generated schema drifted in CI although the response bodies matched. Explicit text keeps one contract under both runtimes.
Alternatives considered:
- Generate only with the CI Python version: rejected because local checks would still drift under the developer runtime.
- Ignore descriptions in the drift check: rejected because it would weaken the full-schema comparison.

## 2026-09-24 — Deterministic analysis tool boundary
Decision: Seven read-only tools accept a committed version and validated bounded parameters, then load only membership-scoped canonical rows; Decimal arithmetic and evidence IDs stay in structured results.
Reason: The graph can select calculations but cannot issue arbitrary SQL or mutate the ledger. A 10,000-transaction ceiling and bounded result pages make compute and output predictable.
Alternatives considered:
- Pass raw SQL into tools: rejected because it bypasses reviewable tool bounds and workspace scoping.
- Analyze browser workbook state: rejected because committed canonical records are the authoritative input.

## 2026-09-24 — Bounded analysis state and recovery
Decision: Run the four existing LangGraph nodes with at most two investigation rounds, eight tool calls, and 180 active seconds; persist stage checkpoints and tool outputs between node executions. Repeating create for the same version reclaims an expired run lease and resumes from the last valid checkpoint.
Reason: The requested four-route API excludes the spec's separate resume endpoint. Reusing POST preserves the unique run constraint and gives a sleeping Render service an explicit, authenticated wake-up path. One stage per transaction keeps checkpoints durable across process death.
Alternatives considered:
- Add a fifth resume route: rejected because the D request explicitly allows only four routes.
- Run the entire graph under one database transaction: rejected because a process death would discard every checkpoint and tool result.

## 2026-09-24 — Evidence-backed findings and abstention
Decision: Findings are deterministic templates carrying tool-result UUID metric_refs and transaction UUID source_refs. Validation rejects dangling or cross-version references and unsupported numeric text; ambiguous or insufficient data produces a data-quality limitation or no finding rather than a guessed cause.
Reason: Schema-valid prose is not evidence. Cash-flow totals must not be labelled profit, and zero-baseline changes remain undefined.
Alternatives considered:
- Save unverified draft findings: rejected because readers could mistake unsupported claims for confirmed analysis.
- Assign numeric confidence: rejected because no calibrated model or evaluation supports it.

## 2026-09-24 — Evidence navigation within paginated imports
Decision: Add an optional transaction focus parameter to the existing import-detail read so the server selects the correct ledger page; render findings on that same page and scroll to the transaction ID.
Reason: The D API allows no new transaction endpoint, while a source reference may be on any page. Server-side rank lookup avoids client-side scans and preserves the existing import flow when focus is omitted.
Alternatives considered:
- Fetch every import page in the browser: rejected because large workbooks would cause unbounded network work.
- Add a fifth route: rejected because the D request explicitly limits new routes.

## 2026-09-24 — Checkpoint retention and partial runs
Decision: Keep terminal reports and tool-result audit rows, but delete checkpoints for terminal runs 30 days after completion during a later authorized create. A failure after a durable stage is marked partial; validation failure before a report is marked failed.
Reason: Checkpoint payloads may contain workbook-derived data and need bounded retention. A partial status tells the user that some calculation finished but no complete validated report was published. Cleanup is workspace-scoped and never touches active runs.
Alternatives considered:
- Keep all checkpoint payloads forever: rejected because their data footprint grows without improving final reports.
- Delete checkpoints at completion: rejected because recent restart/debug evidence would disappear immediately.

## 2026-09-24 — Do not mislink excluded rows as transaction evidence
Decision: A data-quality finding about excluded workbook rows is not emitted until the UI can link the excluded source row itself; the quality tool still reports the count, and cash-flow findings state the limitation. Emit data-quality findings only for conditions evidenced by linked included transactions.
Reason: Pointing an excluded-row claim at an unrelated included transaction would pass ID validation but mislead the reader. This narrows the earlier evidence-backed-findings decision without changing its reference rule.
Alternatives considered:
- Link any included transaction to an excluded-row warning: rejected because the evidence does not support the claim.
- Add a source-row detail endpoint now: rejected because D permits only four new routes.

## 2026-09-24 — Apply deterministic analysis runtime access
Decision: Apply `202609240003_analysis_runtime_access.sql` in the live Supabase SQL Editor, as with the C runtime migration, after auditing `mill_runtime` privileges and policies.
Reason: Render already serves the merged D code, but its restricted role lacked the grants and RLS policies needed to persist and read analysis. The migration adds only the reviewed permissions and seven guarded policies; the request path still uses `mill_runtime`.
Rollback: Drop those seven D policies and revoke INSERT/UPDATE on `analysis_runs`, SELECT/INSERT on `tool_results` and `findings`, and DELETE on `graph_checkpoints`. Preserve earlier SELECT on `analysis_runs` and checkpoint read/write grants.
Alternatives considered:
- Use migration credentials in Render: rejected because privileged credentials do not belong in the request service.
- Grant broad table access without RLS: rejected because direct SQL must remain workspace-scoped.
