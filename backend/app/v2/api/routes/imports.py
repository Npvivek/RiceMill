"""HTTP boundary for the synchronous, workspace-scoped import flow."""

from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel

from app.v2.auth import AuthenticatedUser, bearer_scheme, get_current_user
from app.v2.config import Settings, get_settings
from app.v2.db import runtime_engine
from app.v2.imports.models import ImportDetail, ImportFailure, ImportPage, ImportResult, TransactionRecord
from app.v2.imports.parser import MAX_COMPRESSED_BYTES
from app.v2.imports.service import ImportService, PostgresImportRepository, SupabaseStorageGateway

router = APIRouter()


class ImportSummaryResponse(BaseModel):
    id: UUID
    file_name: str
    status: str
    source_row_count: int
    transaction_count: int
    income_total: str
    expense_total: str
    created_at: datetime
    error_code: str | None
    error_message: str | None


class ImportPageResponse(BaseModel):
    items: list[ImportSummaryResponse]
    page: int
    page_size: int
    total: int


class TransactionResponse(BaseModel):
    id: UUID
    source_sheet: str
    source_row: int
    transaction_date: date
    description: str
    direction: str
    amount: str
    category: str


class ImportDetailResponse(BaseModel):
    import_record: ImportSummaryResponse
    transactions: list[TransactionResponse]
    page: int
    page_size: int
    total: int


class ImportErrorResponse(BaseModel):
    code: str
    message: str
    retryable: bool
    import_id: UUID | None = None


def _summary(result: ImportResult) -> ImportSummaryResponse:
    return ImportSummaryResponse(
        id=result.id, file_name=result.file_name, status=result.status,
        source_row_count=result.source_row_count, transaction_count=result.transaction_count,
        income_total=f"{result.income_total:.2f}", expense_total=f"{result.expense_total:.2f}",
        created_at=result.created_at, error_code=result.error_code, error_message=result.error_message,
    )


def _transaction(record: TransactionRecord) -> TransactionResponse:
    return TransactionResponse(
        id=record.id, source_sheet=record.source_sheet, source_row=record.source_row,
        transaction_date=record.transaction_date, description=record.description,
        direction=record.direction, amount=f"{record.amount:.2f}", category=record.category,
    )


def _failure(error: ImportFailure) -> JSONResponse:
    body = ImportErrorResponse(
        code=error.code, message=error.message, retryable=error.retryable, import_id=error.import_id,
    )
    return JSONResponse(status_code=error.status_code, content=body.model_dump(mode="json"))


def get_import_service(settings: Settings = Depends(get_settings)) -> ImportService:
    if not settings.runtime_database_url:
        raise HTTPException(status_code=503, detail="Import database is not configured.")
    try:
        engine = runtime_engine(settings.runtime_database_url, settings.app_environment)
        storage = SupabaseStorageGateway(settings.supabase_url, settings.supabase_publishable_key)
    except (ValueError, ImportFailure) as error:
        raise HTTPException(status_code=503, detail="Import service is not configured.") from error
    return ImportService(PostgresImportRepository(engine), storage)


@router.post("/imports", response_model=ImportSummaryResponse, status_code=201,
             responses={200: {"model": ImportSummaryResponse}, 403: {"model": ImportErrorResponse},
                        413: {"model": ImportErrorResponse}, 422: {"model": ImportErrorResponse},
                        503: {"model": ImportErrorResponse}})
def upload_import(
    response: Response,
    file: UploadFile = File(...),
    file_hash: str | None = Form(default=None),
    user: AuthenticatedUser = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    service: ImportService = Depends(get_import_service),
) -> ImportSummaryResponse | JSONResponse:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Sign in to upload a workbook.")
    try:
        content = file.file.read(MAX_COMPRESSED_BYTES + 1)
        result, duplicate = service.create_import(UUID(user.id), credentials.credentials,
                                                  file.filename or "", content, file_hash)
    except ImportFailure as error:
        return _failure(error)
    finally:
        file.file.close()
    response.status_code = 200 if duplicate else 201
    return _summary(result)


@router.get("/imports", response_model=ImportPageResponse,
            responses={403: {"model": ImportErrorResponse}, 503: {"model": ImportErrorResponse}})
def list_imports(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user),
    service: ImportService = Depends(get_import_service),
) -> ImportPageResponse | JSONResponse:
    try:
        result: ImportPage = service.list_imports(UUID(user.id), page, page_size)
    except ImportFailure as error:
        return _failure(error)
    return ImportPageResponse(items=[_summary(item) for item in result.items],
                              page=result.page, page_size=result.page_size, total=result.total)


@router.get("/imports/{import_id}", response_model=ImportDetailResponse,
            responses={403: {"model": ImportErrorResponse}, 404: {"model": ImportErrorResponse},
                       503: {"model": ImportErrorResponse}})
def get_import(
    import_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user),
    service: ImportService = Depends(get_import_service),
) -> ImportDetailResponse | JSONResponse:
    try:
        result: ImportDetail = service.get_import(UUID(user.id), import_id, page, page_size)
    except ImportFailure as error:
        return _failure(error)
    return ImportDetailResponse(
        import_record=_summary(result.result), transactions=[_transaction(item) for item in result.transactions],
        page=result.page, page_size=result.page_size, total=result.total,
    )
