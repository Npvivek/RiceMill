"""Request-scoped, restricted Postgres access for the verified Supabase user."""

from collections.abc import Generator
from functools import lru_cache

from fastapi import Depends, HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import Session

from app.v2.auth import AuthenticatedUser, get_current_user
from app.v2.config import Settings, get_settings


@lru_cache
def runtime_engine(url: str, environment: str) -> Engine:
    parsed = make_url(url)
    if parsed.drivername != "postgresql+psycopg" or not parsed.username:
        raise ValueError("RUNTIME_DATABASE_URL must use postgresql+psycopg and a restricted role")
    if parsed.username.split(".")[0] != "mill_runtime":
        raise ValueError("RUNTIME_DATABASE_URL must authenticate as mill_runtime")
    if environment == "production" and (
        not parsed.host or not parsed.host.endswith(".pooler.supabase.com") or parsed.port != 5432
    ):
        raise ValueError("Production runtime DB must use the Supabase session pooler on port 5432")
    return create_engine(
        url,
        pool_size=2,
        max_overflow=0,
        pool_timeout=5,
        pool_pre_ping=True,
        connect_args={"sslmode": "require", "connect_timeout": 5} if environment == "production" else {},
    )


def get_scoped_session(
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> Generator[Session, None, None]:
    if not settings.runtime_database_url:
        raise HTTPException(status_code=503, detail="Workspace database is not configured.")
    try:
        engine = runtime_engine(settings.runtime_database_url, settings.app_environment)
    except ValueError as error:
        raise HTTPException(status_code=503, detail="Workspace database configuration is invalid.") from error

    with Session(engine) as session, session.begin():
        # SET LOCAL is cleared at transaction end even when the pool reuses this connection.
        # Only the verified token subject reaches this statement.
        session.execute(text("select set_config('request.jwt.claim.sub', :subject, true)"), {"subject": user.id})
        yield session
