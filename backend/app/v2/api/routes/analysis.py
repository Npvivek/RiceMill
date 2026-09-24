"""Four authenticated routes for deterministic dataset analysis."""

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError

from app.v2.ai.service import MAX_ATTEMPTS, AnalysisFailure, AnalysisService, PostgresAnalysisRepository
from app.v2.auth import AuthenticatedUser, get_current_user
from app.v2.config import Settings, get_settings
from app.v2.db import runtime_engine

router = APIRouter()


class FindingResponse(BaseModel):
    id: UUID
    type: str
    severity: str
    title: str
    explanation: str
    metric_refs: list[str]
    source_refs: list[str]
    limitations: str
    suggested_check: str | None


class ToolCallResponse(BaseModel):
    id: UUID
    tool_name: str
    input: dict[str, Any]
    result: dict[str, Any]
    created_at: datetime


class AnalysisRunResponse(BaseModel):
    id: UUID
    dataset_version_id: UUID
    status: str
    stage: str
    attempt_count: int
    active_lease_until: datetime | None
    error_code: str | None
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    findings: list[FindingResponse]
    tool_calls: list[ToolCallResponse]


class AnalysisRunPageResponse(BaseModel):
    items: list[AnalysisRunResponse]
    page: int
    page_size: int
    total: int


class AnalysisErrorResponse(BaseModel):
    code: str
    message: str


def get_analysis_service(settings: Settings = Depends(get_settings)) -> AnalysisService:
    if not settings.runtime_database_url:
        raise HTTPException(status_code=503, detail="Analysis database is not configured.")
    try:
        engine = runtime_engine(settings.runtime_database_url, settings.app_environment)
    except ValueError as error:
        raise HTTPException(status_code=503, detail="Analysis database configuration is invalid.") from error
    return AnalysisService(PostgresAnalysisRepository(engine))


def _error(error: AnalysisFailure) -> HTTPException:
    return HTTPException(status_code=error.status_code, detail={"code": error.code, "message": error.message})


@router.post("/datasets/{version_id}/analysis-runs", response_model=AnalysisRunResponse, status_code=202,
             responses={403: {"model": AnalysisErrorResponse}, 404: {"model": AnalysisErrorResponse},
                        503: {"model": AnalysisErrorResponse}})
def create_analysis_run(
    version_id: UUID, background_tasks: BackgroundTasks, response: Response,
    user: AuthenticatedUser = Depends(get_current_user),
    service: AnalysisService = Depends(get_analysis_service),
) -> AnalysisRunResponse:
    try:
        run, created = service.create(UUID(user.id), version_id)
    except AnalysisFailure as error:
        raise _error(error) from error
    except SQLAlchemyError as error:
        raise HTTPException(status_code=503, detail="Analysis database is unavailable.") from error
    expired = (run["status"] == "running" and run["active_lease_until"] is not None
               and run["active_lease_until"].timestamp() < datetime.now().astimezone().timestamp())
    if run["attempt_count"] >= MAX_ATTEMPTS and (run["status"] in ("failed", "partial") or expired):
        raise HTTPException(status_code=409, detail={"code": "retry_exhausted",
                                                     "message": "Analysis retry limit reached."})
    if run["status"] in ("queued", "failed", "partial") or expired:
        background_tasks.add_task(service.execute, UUID(user.id), run["id"])
    response.status_code = 202 if created or run["status"] in ("queued", "running", "failed", "partial") else 200
    return AnalysisRunResponse.model_validate(run)


@router.get("/analysis-runs/{run_id}", response_model=AnalysisRunResponse,
            responses={404: {"model": AnalysisErrorResponse}})
def get_analysis_run(
    run_id: UUID, user: AuthenticatedUser = Depends(get_current_user),
    service: AnalysisService = Depends(get_analysis_service),
) -> AnalysisRunResponse:
    try:
        return AnalysisRunResponse.model_validate(service.repository.get(UUID(user.id), run_id))
    except AnalysisFailure as error:
        raise _error(error) from error
    except SQLAlchemyError as error:
        raise HTTPException(status_code=503, detail="Analysis database is unavailable.") from error


@router.get("/analysis-runs", response_model=AnalysisRunPageResponse,
            responses={404: {"model": AnalysisErrorResponse}})
def list_analysis_runs(
    dataset_version_id: UUID, page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user),
    service: AnalysisService = Depends(get_analysis_service),
) -> AnalysisRunPageResponse:
    try:
        return AnalysisRunPageResponse.model_validate(
            service.repository.list(UUID(user.id), dataset_version_id, page, page_size))
    except AnalysisFailure as error:
        raise _error(error) from error
    except SQLAlchemyError as error:
        raise HTTPException(status_code=503, detail="Analysis database is unavailable.") from error


@router.post("/analysis-runs/{run_id}/cancel", response_model=AnalysisRunResponse,
             responses={404: {"model": AnalysisErrorResponse}, 409: {"model": AnalysisErrorResponse}})
def cancel_analysis_run(
    run_id: UUID, user: AuthenticatedUser = Depends(get_current_user),
    service: AnalysisService = Depends(get_analysis_service),
) -> AnalysisRunResponse:
    try:
        return AnalysisRunResponse.model_validate(service.repository.cancel(UUID(user.id), run_id))
    except AnalysisFailure as error:
        raise _error(error) from error
    except SQLAlchemyError as error:
        raise HTTPException(status_code=503, detail="Analysis database is unavailable.") from error
