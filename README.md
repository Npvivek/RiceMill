# Panduranga Rice Mill

Marketing website and private, browser-based Excel analysis workspace for a family rice mill in Hanuman Junction, Eluru district, Andhra Pradesh.

**Live frontend:** [rice-mill-steel.vercel.app](https://rice-mill-steel.vercel.app/)

## What is active

- Public marketing pages for mill by-products and paddy procurement
- Products page with direct call/WhatsApp pricing
- Contact enquiries sent through WhatsApp
- Email/passcode-protected dashboard at `/dashboard` for analyzing rice-mill `.xlsx` account workbooks
- Persistent, account-private report history backed by Supabase Postgres
- A v2 FastAPI/LangGraph foundation on Render with Supabase JWT validation and workspace-scoped database access. It is not yet connected to the workbook import UI, and it makes no external model calls.

The Excel analyzer runs completely in the browser. Original workbooks are not uploaded, stored, or sent to an API. The generated analysis is saved privately so reports can be reopened later. It detects transaction tables across multiple sheets and reports:

- income, expenses, and net cash flow
- monthly movement
- rice-mill categories such as bran, husk, broken rice, paddy, transport, labour, and repairs
- the largest entries
- per-sheet classification and data-quality warnings

## Current architecture

```text
Browser
├── Public marketing site
└── Supabase-authenticated dashboard
    ├── Local .xlsx parsing and analysis (no workbook upload)
    └── Private report history → Supabase Postgres + Row Level Security

Next.js 16 + React 19 → Vercel

FastAPI v2 → Render Docker service
├── Verifies Supabase access tokens against the project's signing keys
├── Resolves workspace membership with a restricted Postgres runtime role
├── Provides liveness, readiness, identity, and workspace endpoints
└── Contains a bounded deterministic LangGraph shell and scoped checkpoint saver
```

The existing report workflow remains browser-only and does not wait for the Python service. The v2 API is foundation for a future reviewed import and canonical analysis flow. See [the implementation handoff](tasks/rice-mill-v2.md) for what is implemented versus still pending, and [business context](docs/business-context.md) for historical domain notes. The [implementation spec](specs/ai-backend-and-dashboard.md) is the unchanged roadmap.

## Supabase setup

1. Create users manually under **Authentication → Users**. Public signup is intentionally not exposed.
2. Run `supabase/migrations/202608020001_create_reports.sql` in the Supabase SQL Editor.
3. Run `supabase/migrations/202609220001_create_workspace_analysis.sql` to add the v2 workspace, import, ledger, analysis, and private-workbook Storage schema. This additive migration does not alter existing reports.
4. Run `supabase/migrations/202609230001_runtime_workspace_role.sql` and then `supabase/migrations/202609230002_runtime_membership_claim.sql` for the restricted runtime role and membership policies.
5. Configure the following in `frontend/.env.local` for development and in Vercel for deployment:

```text
NEXT_PUBLIC_SITE_URL=https://your-vercel-domain.example
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

6. In Supabase Authentication URL Configuration, set the production site URL and allow these redirects:

```text
http://localhost:3000/auth/callback
https://your-vercel-domain.example/auth/callback
```

Only the publishable key is used by the application. Report access is enforced with Row Level Security using the logged-in Supabase user ID.

## Python v2 service

`render.yaml` defines the Docker web service. Configure these environment variables in Render:

```text
CORS_ORIGINS=https://rice-mill-steel.vercel.app,http://localhost:3000
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_JWKS_URL=https://your-project-ref.supabase.co/auth/v1/.well-known/jwks.json
RUNTIME_DATABASE_URL=postgresql+psycopg://mill_runtime.PROJECT_REF:PASSWORD@REGION.pooler.supabase.com:5432/postgres
```

No external model provider is configured. Adding one later requires a new implementation decision, an explicit provider configuration, and sanitized evaluation fixtures.

Local checks:

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --reload
.venv/bin/ruff check app tests scripts
.venv/bin/mypy --follow-imports=silent --ignore-missing-imports app/v2 scripts/export_openapi.py
.venv/bin/pytest -q
cd .. && ./scripts/check-api-contract.sh
```

The v2 API uses the Supabase **session pooler on port 5432**. The request
transaction uses `SET LOCAL` RLS claims, and session mode supports Psycopg's
prepared statements and the checkpoint connection. The transaction pooler on
port 6543 does not support prepared statements. The runtime role is
`mill_runtime`, has no BYPASSRLS or
ownership privileges, and is the only database credential read by the v2 web
service. Its pool is bounded to two connections with no overflow. The
`MIGRATION_DATABASE_URL` or SQL Editor admin session is used separately to apply
`supabase/migrations/*.sql`; it must never be configured on Render or Vercel.
The two runtime migrations follow the earlier workspace migration. Supabase's
SQL Editor role cannot grant `mill_runtime` usage on the `auth` schema, so the
second migration makes its membership policy read the transaction-local,
verified JWT subject directly. Then set a long random password for
`mill_runtime` outside Git and store
the resulting session-pooler URL only in Render's `RUNTIME_DATABASE_URL` secret.

For the opt-in automated live RLS integration test, provide `TEST_MIGRATION_DATABASE_URL`,
`TEST_RUNTIME_DATABASE_URL`, and one existing Supabase Auth user ID as
`TEST_USER_A`; run
`.venv/bin/pytest -q tests/test_workspace_rls_integration.py`. It creates only
synthetic rows in two workspaces, removes membership from one, then cleans up.
The PR #2 live two-workspace isolation probe exercised the equivalent paths manually; the automated test remains skipped without an admin test URL.
After deployment, call `/health/ready` (requires a real `mill_runtime`
connection), restart the **service process** in Render, and call it again.
The PR #2 probe used Render deploy `dep-dapdokss728c73ehd1kg` and observed HTTP
200 from `/health/ready` before and after a real service restart. Future
deployment changes should repeat the readiness check.

The FastAPI OpenAPI document is served at `/openapi.json` even when Swagger UI
is disabled. Regenerate the committed contract with
`PYTHONPATH=backend backend/.venv/bin/python backend/scripts/export_openapi.py`
and `cd frontend && npx openapi-typescript ../backend/openapi.json -o src/lib/api/schema.d.ts`.
`npm run check:api` checks both committed OpenAPI against the live FastAPI app
schema and generated TypeScript against that document. Set
`NEXT_PUBLIC_V2_API_URL` to the Render API origin before calling the typed v2
client from the browser; the existing report dashboard does not depend on it.

## Local frontend development

```bash
cd frontend
test -f .env.local || cp .env.example .env.local
npm install
npm run dev
```

Fill in the Supabase project URL and publishable key in `frontend/.env.local`, then open [http://localhost:3000](http://localhost:3000). Supabase configuration is required for login and persistent report history; the browser-only report flow does not need the FastAPI service. To work on the v2 API locally, copy `backend/.env.example` to `backend/.env` and supply the server-side settings. `backend/requirements.txt` contains runtime packages; `backend/requirements-dev.txt` adds lint and test tools. `NEXT_PUBLIC_*` values are embedded in a production frontend build, so set them in Vercel before building.

## Private local data

`Data/` and `license/` are intentionally ignored by Git. Store private account workbooks and operating documents there only on trusted local machines.

The license files were committed once before being ignored. Removing them from the current branch does not erase copies from existing Git history; history rewriting and a coordinated force-push are required if those old objects must be purged from GitHub entirely.

## Useful commands

```bash
cd frontend
npm run lint
npm run build
```
