from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.v2.config import Settings, get_settings

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    service: str


@router.get("/health/live", response_model=HealthResponse)
def live() -> HealthResponse:
    return HealthResponse(status="ok", service="rice-mill-api")


@router.get("/health/ready", response_model=HealthResponse)
def ready(settings: Settings = Depends(get_settings)) -> HealthResponse:
    return HealthResponse(
        status="ok" if settings.is_auth_configured else "configuration_required",
        service="rice-mill-api",
    )
