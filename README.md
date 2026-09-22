# Panduranga Rice Mill

[Live site](https://rice-mill-steel.vercel.app/) · Family rice mill in Hanuman Junction, Andhra Pradesh.

- **Current dashboard:** analyzes `.xlsx` workbooks in the browser. Original files stay on the device; saved reports use Supabase Postgres with Row Level Security.
- **v2 API:** Python/FastAPI on Render validates Supabase JWTs, scopes access through `workspace_members` and the restricted `mill_runtime` role, and contains a deterministic LangGraph shell. It does not yet power workbook imports or call an external model.

See the [documentation index](tasks/README.md) for read order and current status.

## Frontend

```bash
cd frontend
npm install
test -f .env.local || cp .env.example .env.local
npm run dev
```

Set the Supabase URL and publishable key in `frontend/.env.local` and Vercel; Next.js embeds `NEXT_PUBLIC_*` values at build time. `NEXT_PUBLIC_V2_API_URL` is optional until the frontend calls v2. Add local and production `/auth/callback` URLs to Supabase Auth redirects.

## Database and API

Apply Supabase SQL migrations in filename order. They add private reports, v2 workspace tables, the restricted runtime role, and membership RLS.

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
test -f .env || cp .env.example .env
.venv/bin/uvicorn app.main:app --reload
```

Use the Supabase **session pooler on port 5432** for `RUNTIME_DATABASE_URL`. Give Render only the `mill_runtime` URL, never the migration/admin URL. `backend/requirements-dev.txt` adds checks to production dependencies; `render.yaml` defines the Docker service. Browser-only reports run without this API.

## Checks

```bash
cd backend
.venv/bin/ruff check app tests scripts
.venv/bin/mypy --follow-imports=silent --ignore-missing-imports app/v2 scripts/export_openapi.py
.venv/bin/pytest -q
cd ../frontend
npm run lint
npm run build
npm run check:api
```

`check:api` detects generated-type drift. The opt-in live RLS test needs `TEST_MIGRATION_DATABASE_URL`, `TEST_RUNTIME_DATABASE_URL`, and `TEST_USER_A`; see the [handoff](tasks/rice-mill-v2.md) for probe and restart evidence.

`Data/` and `license/` are ignored private local folders. Some licence files remain in old Git history; removing them from the branch did not purge that history.
