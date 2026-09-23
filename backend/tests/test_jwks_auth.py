from datetime import UTC, datetime, timedelta

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError

from app.main import app
from app.v2.config import Settings, get_settings

USER_ID = "d6dc7666-86c7-41b7-8e96-602efba4cb0d"
ISSUER = "https://project.supabase.co/auth/v1"


@pytest.fixture
def jwks_auth(monkeypatch):
    import app.v2.auth as auth

    private_key = ec.generate_private_key(ec.SECP256R1())
    public_jwk = jwt.algorithms.ECAlgorithm.to_jwk(private_key.public_key(), as_dict=True)
    public_jwk.update({"kid": "current", "alg": "ES256", "use": "sig"})
    client = PyJWKClient(f"{ISSUER}/.well-known/jwks.json", cache_jwk_set=True)
    monkeypatch.setattr(client, "fetch_data", lambda: {"keys": [public_jwk]})
    monkeypatch.setattr(auth, "get_jwk_client", lambda _url: client)
    app.dependency_overrides[get_settings] = lambda: Settings(SUPABASE_URL="https://project.supabase.co")

    def sign(*, kid="current", **overrides):
        claims = {
            "sub": USER_ID,
            "email": "owner@example.com",
            "aud": "authenticated",
            "iss": ISSUER,
            "exp": datetime.now(UTC) + timedelta(minutes=5),
        }
        claims.update(overrides)
        return jwt.encode(claims, private_key, algorithm="ES256", headers={"kid": kid})

    try:
        yield client, sign
    finally:
        app.dependency_overrides.clear()


def test_jwks_token_authenticates(jwks_auth) -> None:
    _, sign = jwks_auth
    response = TestClient(app).get("/v2/me", headers={"Authorization": f"Bearer {sign()}"})
    assert response.status_code == 200
    assert response.json() == {"id": USER_ID, "email": "owner@example.com"}


@pytest.mark.parametrize("invalid", [
    {"aud": "service_role"},
    {"iss": "https://other.supabase.co/auth/v1"},
    {"exp": datetime.now(UTC) - timedelta(minutes=1)},
])
def test_jwks_token_rejects_wrong_audience_issuer_or_expiry(jwks_auth, invalid) -> None:
    _, sign = jwks_auth
    response = TestClient(app).get("/v2/me", headers={"Authorization": f"Bearer {sign(**invalid)}"})
    assert response.status_code == 401


def test_unknown_jwks_key_returns_401(jwks_auth) -> None:
    _, sign = jwks_auth
    response = TestClient(app).get("/v2/me", headers={"Authorization": f"Bearer {sign(kid='unknown')}"})
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_jwks_fetch_failure_returns_503(jwks_auth, monkeypatch) -> None:
    client, sign = jwks_auth

    def fail_fetch():
        raise PyJWKClientConnectionError("synthetic fetch failure")

    monkeypatch.setattr(client, "fetch_data", fail_fetch)
    response = TestClient(app).get("/v2/me", headers={"Authorization": f"Bearer {sign()}"})
    assert response.status_code == 503
    assert response.json() == {"detail": "Verification keys are temporarily unavailable."}
