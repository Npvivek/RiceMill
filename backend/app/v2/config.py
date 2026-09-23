from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_environment: str = Field(default="development", validation_alias="APP_ENVIRONMENT")
    cors_origins_raw: str = Field(default="http://localhost:3000", validation_alias="CORS_ORIGINS")
    supabase_url: str = Field(default="", validation_alias="SUPABASE_URL")
    supabase_publishable_key: str = Field(default="", validation_alias="SUPABASE_PUBLISHABLE_KEY", repr=False)
    supabase_jwks_url: str = Field(default="", validation_alias="SUPABASE_JWKS_URL")
    supabase_jwt_secret: str = Field(default="", validation_alias="SUPABASE_JWT_SECRET")
    supabase_jwt_audience: str = Field(default="authenticated", validation_alias="SUPABASE_JWT_AUDIENCE")
    docs_enabled: bool = Field(default=True, validation_alias="DOCS_ENABLED")
    runtime_database_url: str = Field(default="", validation_alias="RUNTIME_DATABASE_URL", repr=False)

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]

    @property
    def issuer(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1" if self.supabase_url else ""

    @property
    def jwks_url(self) -> str:
        if self.supabase_jwks_url:
            return self.supabase_jwks_url
        return f"{self.issuer}/.well-known/jwks.json" if self.issuer else ""

    @property
    def is_auth_configured(self) -> bool:
        return bool(self.supabase_url and (self.supabase_jwt_secret or self.jwks_url))

@lru_cache
def get_settings() -> Settings:
    return Settings()
