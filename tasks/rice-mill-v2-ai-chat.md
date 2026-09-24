# AI chat and anomalies implementation

**Spec:** [Conversational AI and Intelligent Anomalies](../specs/ai-chat-and-anomalies.md). **Status:** draft [PR #7](https://github.com/Npvivek/RiceMill/pull/7) prepared; chat migration applied, manual UI test pending.

- [x] Establish a review branch; verify the seven existing tools, scoped database access, import UI, and generated API contract. Preserve raw workbook and transaction rows.
- [x] Pin the Postgres checkpointer dependency. Add an additive migration for conversation writes and separate LangGraph chat checkpoint tables, with membership-scoped RLS and least-privilege `mill_runtime` grants. Keep schema setup out of request startup.
- [x] Add environment-only OpenRouter configuration and a bounded HTTP adapter for `inclusionai/ling-3.0-flash-fin:free`; never log the key, prompts, raw rows, or model responses.
- [x] Implement the dual-mode LangGraph workflow: agent-selected read-only deterministic tools, bounded tool execution, XML citation validation, and explicit abstention. Reject unsupported numeric claims and references; never write ledger data.
- [x] Implement authorization-checked conversation create, message, and history routes. Use server-generated thread IDs and `langgraph-checkpoint-postgres` only for chat; keep anomaly generation separate from deterministic run checkpoints. On provider 429/5xx, return an explicit deterministic-insights fallback.
- [x] Add a generated-contract API client, chat component, and automatic anomaly panel on committed import details. Render citations as ledger links and distinguish AI observations, fallback, and validation failures.
- [x] Add focused validator, graph, adapter, authorization, and API-route tests with synthetic rows and mocked provider; test foreign threads, forged references, malformed XML, numeric claims, rate limits, and provider failures.
- [x] Run Ruff, mypy, pytest, OpenAPI/TypeScript drift check, frontend lint, and build. Fix all failures and inspect the final diff for secrets or unauthorized writes.
- [x] Update documentation index and deployment handoff with migration/env steps and unverified hosted gates. Commit on the branch, push, and prepare a reviewable PR without merging or deploying. Stop for the owner's manual end-to-end UI test.
- [x] Allow malformed transaction rows to be excluded with source coordinates and reasons while valid rows commit; retry an earlier failed same-hash import in place for its uploader. Direct dashboard entry to `/import` and keep earlier browser reports readable.
- [ ] Run the new chat backend with restricted database and model configuration, then complete the owner's manual end-to-end UI test before merging.

## Deployment handoff

The [additive chat migration](../supabase/migrations/202609240004_chat_runtime_access.sql#L1) was applied in the live Supabase SQL Editor after correcting an ambiguous policy reference; the editor reported success. It creates `chat_graph` tables for pinned `langgraph-checkpoint-postgres` and grants `mill_runtime` scoped DML access. Never run `PostgresSaver.setup()` in the request service. Keep the existing restricted session-pooler `RUNTIME_DATABASE_URL`; supply `OPENROUTER_API_KEY` as a secret when deploying the chat backend. Deploy backend and frontend from the same reviewed commit so their generated API contract matches.

The current branch has local automated verification and an SQL Editor success result. Live RLS, checkpoint persistence across a Render restart, Render chat-secret configuration, and manual browser behavior remain unverified. The local backend environment lacks the v2 restricted database configuration, and the local frontend still points to the previously deployed backend, so local AI chat needs a backend running this branch. For the owner's end-to-end test, open a committed import, confirm static insights remain visible, inspect the automatic anomaly observation and linked ledger evidence, send several chat turns, then reload and confirm history persists. Try a question asking for an unsupported number and verify abstention; confirm the deterministic fallback remains visible if the provider is unavailable. Do not merge until these hosted checks pass.

Local evidence after parser and navigation changes: Ruff and mypy passed; pytest reported 79 passed and 1 skipped; the OpenAPI/TypeScript drift check, frontend lint, and production build passed. The earlier synthetic provider smoke call returned the expected `get_data_quality` tool request. No live workbook content was sent in that smoke call.
