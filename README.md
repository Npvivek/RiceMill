# Panduranga Rice Mill

[Live site](https://rice-mill-steel.vercel.app/) · Family rice mill in Hanuman Junction, Andhra Pradesh.

- **Current dashboard:** analyzes `.xlsx` workbooks in the browser. Original files stay on the device; saved reports use Supabase Postgres with Row Level Security.
- **v2 API:** Python/FastAPI on Render validates Supabase JWTs, scopes access through `workspace_members` and the restricted `mill_runtime` role, and contains a deterministic LangGraph shell. It does not yet power workbook imports or call an external model.

See [tasks](tasks/rice-mill-v2.md) for release status, [business context](docs/business-context.md) for historical domain notes, and the unchanged [implementation spec](specs/ai-backend-and-dashboard.md) for the roadmap.

## Frontend

```bash
cd frontend
npm install
test -f .env.local || cp .env.example .env.local
npm run dev
```

Set the Supabase URL and publishable key in `frontend/.env.local`. Next.js embeds `NEXT_PUBLIC_*` values at build time; set them in Vercel before deployment. `NEXT_PUBLIC_V2_API_URL` is optional until the frontend calls the v2 API. Add local and production `/auth/callback` URLs to Supabase Authentication redirects.

## Database and API

Apply the Supabase SQL migrations in filename order. The first creates private reports; the later migrations add v2 workspace tables, the restricted runtime role, and membership RLS. Migrations are additive.

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
test -f .env || cp .env.example .env
.venv/bin/uvicorn app.main:app --reload
```

Use the Supabase **session pooler on port 5432** for `RUNTIME_DATABASE_URL`. Store only the `mill_runtime` URL in Render. Keep the migration/admin URL out of the web service. `backend/requirements.txt` contains production packages; `requirements-dev.txt` adds test and lint tools. `render.yaml` defines the Docker service. The browser-only report flow runs without this API.

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

`check:api` detects drift between FastAPI OpenAPI and generated TypeScript types. The opt-in live RLS test needs `TEST_MIGRATION_DATABASE_URL`, `TEST_RUNTIME_DATABASE_URL`, and `TEST_USER_A`; see [the handoff](tasks/rice-mill-v2.md) for live probe and restart evidence.

`Data/` and `license/` are ignored private local folders. Some licence files remain in old Git history; removing them from the branch did not purge that history.
