# Panduranga Rice Mill

Marketing website and private, browser-based Excel analysis workspace for a family rice mill in Hanuman Junction, Eluru district, Andhra Pradesh.

**Live frontend:** [rice-mill-steel.vercel.app](https://rice-mill-steel.vercel.app/)

## What is active

- Public marketing pages for mill by-products and paddy procurement
- Products page with direct call/WhatsApp pricing
- Contact enquiries sent through WhatsApp
- Email/passcode-protected dashboard at `/dashboard` for analyzing rice-mill `.xlsx` account workbooks
- Persistent, account-private report history backed by Supabase Postgres
- A v2 FastAPI/LangGraph foundation with Supabase JWT validation. It is not yet connected to the workbook import UI, and it makes no external model calls.

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
├── Provides liveness, readiness, and identity endpoints
└── Contains a bounded deterministic LangGraph analysis foundation
```

The existing report workflow remains browser-only and does not wait for the Python service. The legacy FastAPI routers remain in `backend/`, but only the v2 service is mounted by `backend/app/main.py`.

## Supabase setup

1. Create users manually under **Authentication → Users**. Public signup is intentionally not exposed.
2. Run `supabase/migrations/202608020001_create_reports.sql` in the Supabase SQL Editor.
3. Run `supabase/migrations/202609220001_create_workspace_analysis.sql` to add the v2 workspace, import, ledger, analysis, and private-workbook Storage schema. This additive migration does not alter existing reports.
4. Configure the following locally and in Vercel:

```text
NEXT_PUBLIC_SITE_URL=https://your-vercel-domain.example
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

4. In Supabase Authentication URL Configuration, set the production site URL and allow these redirects:

```text
http://localhost:3000/auth/callback
https://your-vercel-domain.example/auth/callback
```

Only the publishable key is used by the application. Report access is enforced with Row Level Security using the logged-in Supabase user ID.

## Python v2 service

`render.yaml` defines the initial free Docker web service. Before enabling it in Render, configure these environment variables there:

```text
CORS_ORIGINS=https://rice-mill-steel.vercel.app,http://localhost:3000
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_JWKS_URL=https://your-project-ref.supabase.co/auth/v1/.well-known/jwks.json
```

No external model provider is configured. Adding one later requires a new implementation decision, an explicit provider configuration, and sanitized evaluation fixtures.

Local checks:

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
.venv/bin/ruff check app/v2 tests
.venv/bin/pytest -q
```

## Local development

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Supabase configuration is required for login and persistent report history; no separate FastAPI service is required.

## Private local data

`Data/` and `license/` are intentionally ignored by Git. Store private account workbooks and operating documents there only on trusted local machines.

The license files were committed once before being ignored. Removing them from the current branch does not erase copies from existing Git history; history rewriting and a coordinated force-push are required if those old objects must be purged from GitHub entirely.

## Useful commands

```bash
cd frontend
npm run lint
npm run build
```
