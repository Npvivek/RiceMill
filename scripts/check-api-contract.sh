#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
BACKEND_PYTHON="${BACKEND_PYTHON:-backend/.venv/bin/python}"
PYTHONPATH=backend PYTHONDONTWRITEBYTECODE=1 "$BACKEND_PYTHON" backend/scripts/export_openapi.py --check
frontend/node_modules/.bin/openapi-typescript backend/openapi.json | cmp - frontend/src/lib/api/schema.d.ts
echo "Generated TypeScript contract matches FastAPI OpenAPI"
