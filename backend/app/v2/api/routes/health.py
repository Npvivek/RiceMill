from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.v2.config import Settings, get_settings
from app.v2.db import runtime_engine

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    service: str


@router.get("/health/live", response_model=HealthResponse)
def live() -> HealthResponse:
    return HealthResponse(status="ok", service="rice-mill-api")


@router.get("/health/ready", response_model=HealthResponse)
def ready(settings: Settings = Depends(get_settings)) -> HealthResponse:
    if not settings.is_auth_configured or not settings.runtime_database_url:
        raise HTTPException(status_code=503, detail="Service configuration is incomplete.")
    try:
        with runtime_engine(settings.runtime_database_url, settings.app_environment).connect() as connection:
            role = connection.execute(text("select current_user")).scalar_one()
        if role != "mill_runtime":
            raise ValueError("Unexpected runtime database role")
    except (SQLAlchemyError, ValueError) as error:
        raise HTTPException(status_code=503, detail="Workspace database is unavailable.") from error
    return HealthResponse(status="ok", service="rice-mill-api")
