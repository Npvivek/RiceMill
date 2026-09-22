from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError, PyJWKClient

from app.v2.config import Settings, get_settings

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    email: str | None


@lru_cache
def get_jwk_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=300)


def authentication_error(detail: str = "Your session is invalid or has expired.") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail, headers={"WWW-Authenticate": "Bearer"})


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise authentication_error("Sign in to use the mill workspace.")
    if not settings.is_auth_configured:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication is not configured.")

    try:
        if settings.supabase_jwt_secret:
            claims = jwt.decode(
                credentials.credentials,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience=settings.supabase_jwt_audience,
                issuer=settings.issuer,
                options={"require": ["exp", "sub", "aud", "iss"]},
            )
        else:
            signing_key = get_jwk_client(settings.jwks_url).get_signing_key_from_jwt(credentials.credentials)
            claims = jwt.decode(
                credentials.credentials,
                signing_key.key,
                algorithms=["RS256", "ES256", "EdDSA"],
                audience=settings.supabase_jwt_audience,
                issuer=settings.issuer,
                options={"require": ["exp", "sub", "aud", "iss"]},
            )
    except InvalidTokenError as error:
        raise authentication_error() from error

    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise authentication_error()
    email = claims.get("email")
    return AuthenticatedUser(id=subject, email=email if isinstance(email, str) else None)
