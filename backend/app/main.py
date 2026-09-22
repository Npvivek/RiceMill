from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.v2.api.router import api_router
from app.v2.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Panduranga Rice Mill API",
        version="2.0.0",
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url=None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Request-Id"],
    )
    app.include_router(api_router)
    return app


app = create_app()
