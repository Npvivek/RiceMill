from datetime import UTC, datetime, timedelta

import jwt
from fastapi.testclient import TestClient

from app.main import app
from app.v2.config import Settings, get_settings

client = TestClient(app)


def test_live_health_does_not_require_configuration() -> None:
    response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "rice-mill-api"}


def test_identity_endpoint_requires_a_bearer_token() -> None:
    response = client.get("/v2/me")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_cors_origins_accepts_a_comma_separated_environment_value(monkeypatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example,http://localhost:3000")

    settings = Settings()

    assert settings.cors_origins == ["https://app.example", "http://localhost:3000"]


def test_identity_endpoint_accepts_a_valid_supabase_hs256_token() -> None:
    settings = Settings(
        SUPABASE_URL="https://project.supabase.co",
        SUPABASE_JWT_SECRET="test-secret-that-is-longer-than-32-bytes",
    )
    app.dependency_overrides[get_settings] = lambda: settings
    token = jwt.encode(
        {
            "sub": "d6dc7666-86c7-41b7-8e96-602efba4cb0d",
            "email": "owner@example.com",
            "aud": "authenticated",
            "iss": "https://project.supabase.co/auth/v1",
            "exp": datetime.now(UTC) + timedelta(minutes=5),
        },
        "test-secret-that-is-longer-than-32-bytes",
        algorithm="HS256",
    )

    try:
        response = client.get("/v2/me", headers={"Authorization": f"Bearer {token}"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"id": "d6dc7666-86c7-41b7-8e96-602efba4cb0d", "email": "owner@example.com"}
