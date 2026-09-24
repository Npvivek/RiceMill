"""Import orchestration and restricted Postgres/Storage adapters."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from decimal import Decimal
from typing import Protocol, cast
from urllib.parse import quote
from uuid import UUID, uuid4

import httpx
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.v2.imports.models import (
    Direction, ImportDetail, ImportFailure, ImportPage, ImportResult, ImportStatus,
    ParsedWorkbook, ParseError, TransactionRecord,
)
from app.v2.imports.parser import MAX_COMPRESSED_BYTES, parse_workbook

PARSER_VERSION = "c2"
STORAGE_BUCKET = "mill-workbooks"


class StorageGateway(Protocol):
    def upload(self, path: str, content: bytes, access_token: str) -> None:
        """Store exactly these bytes under a new private path or raise ImportFailure."""


class ImportRepository(Protocol):
    def reserve(self, user_id: UUID, file_name: str, file_hash: str, file_size: int,
                upload: Callable[[str], None]) -> tuple[ImportResult, bool]:
        """Reserve by hash; retry a failed import in place for its original uploader."""

    def mark_failed(self, user_id: UUID, import_id: UUID, code: str, message: str) -> None:
        """Mark only this user's staged import failed."""

    def commit(self, user_id: UUID, import_id: UUID, workbook: ParsedWorkbook) -> ImportResult:
        """Atomically insert one committed version and all source/transaction rows."""

    def list(self, user_id: UUID, page: int, page_size: int) -> ImportPage:
        """Return only the derived workspace's imports."""

    def detail(self, user_id: UUID, import_id: UUID, page: int, page_size: int,
               focus_transaction_id: UUID | None = None) -> ImportDetail:
        """Return a scoped import and one transaction page or raise 404."""


class SupabaseStorageGateway:
    def __init__(self, url: str, publishable_key: str) -> None:
        if not url or not publishable_key:
            raise ImportFailure("storage_unconfigured", "Workbook storage is not configured.", 503, True)
        self._url = url.rstrip("/")
        self._publishable_key = publishable_key

    def upload(self, path: str, content: bytes, access_token: str) -> None:
        endpoint = f"{self._url}/storage/v1/object/{STORAGE_BUCKET}/{quote(path, safe='/')}"
        try:
            response = httpx.post(
                endpoint,
                content=content,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "apikey": self._publishable_key,
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                },
                timeout=45.0,
            )
        except httpx.HTTPError as error:
            raise ImportFailure("storage_unavailable", "Workbook storage is unavailable. Please retry.",
                                503, True) from error
        if response.status_code in (401, 403):
            raise ImportFailure("storage_denied", "Your session cannot upload this workbook.", 403)
        if response.status_code == 413:
            raise ImportFailure("file_size", "The workbook exceeds the Storage size limit.", 413)
        if response.status_code not in (200, 201):
            raise ImportFailure("storage_unavailable", "Workbook storage rejected the upload. Please retry.",
                                503, True)


class PostgresImportRepository:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    @contextmanager
    def _session(self, user_id: UUID) -> Iterator[Session]:
        with Session(self._engine) as session, session.begin():
            session.execute(text("select set_config('request.jwt.claim.sub', :subject, true)"),
                            {"subject": str(user_id)})
            yield session

    @staticmethod
    def _workspace_id(session: Session, user_id: UUID) -> UUID:
        rows = session.execute(text("""
            select workspace_id from public.workspace_members
            where user_id = :user_id order by workspace_id limit 2
        """), {"user_id": user_id}).scalars().all()
        if not rows:
            raise ImportFailure("workspace_denied", "No mill workspace is assigned to your account.", 403)
        if len(rows) != 1:
            raise ImportFailure("workspace_ambiguous", "This account has more than one workspace.", 409)
        return cast(UUID, rows[0])

    @staticmethod
    def _summary(session: Session, workspace_id: UUID, import_id: UUID) -> ImportResult:
        row = session.execute(text("""
            select i.id, i.file_name, i.status, i.created_at, i.error_code, i.error_message,
              (select count(*) from public.source_rows s join public.dataset_versions v
                on v.id = s.dataset_version_id where v.import_id = i.id) as source_row_count,
              (select count(*) from public.transactions t join public.dataset_versions v
                on v.id = t.dataset_version_id where v.import_id = i.id) as transaction_count,
              (select coalesce(sum(t.amount), 0) from public.transactions t
                join public.dataset_versions v on v.id = t.dataset_version_id
                where v.import_id = i.id and t.direction = 'income') as income_total,
              (select coalesce(sum(t.amount), 0) from public.transactions t
                join public.dataset_versions v on v.id = t.dataset_version_id
                where v.import_id = i.id and t.direction = 'expense') as expense_total
            from public.imports i where i.id = :import_id and i.workspace_id = :workspace_id
        """), {"import_id": import_id, "workspace_id": workspace_id}).mappings().first()
        if row is None:
            raise ImportFailure("import_not_found", "Import not found.", 404)
        return ImportResult(
            id=row["id"], file_name=row["file_name"], status=cast(ImportStatus, row["status"]),
            source_row_count=row["source_row_count"], transaction_count=row["transaction_count"],
            income_total=Decimal(row["income_total"]), expense_total=Decimal(row["expense_total"]),
            created_at=row["created_at"], error_code=row["error_code"], error_message=row["error_message"],
        )

    def reserve(self, user_id: UUID, file_name: str, file_hash: str, file_size: int,
                upload: Callable[[str], None]) -> tuple[ImportResult, bool]:
        with self._session(user_id) as session:
            workspace_id = self._workspace_id(session, user_id)
            import_id = uuid4()
            storage_path = f"{workspace_id}/{import_id}.xlsx"
            inserted = session.execute(text("""
                insert into public.imports
                  (id, workspace_id, uploaded_by, file_name, file_hash, file_size,
                   storage_path, parser_version, status)
                values (:id, :workspace_id, :user_id, :file_name, :file_hash, :file_size,
                        :storage_path, :parser_version, 'staged')
                on conflict (workspace_id, file_hash) do nothing returning id
            """), {
                "id": import_id, "workspace_id": workspace_id, "user_id": user_id,
                "file_name": file_name, "file_hash": file_hash, "file_size": file_size,
                "storage_path": storage_path, "parser_version": PARSER_VERSION,
            }).scalar_one_or_none()
            if inserted is None:
                existing = session.execute(text("""
                    select id, status, uploaded_by from public.imports
                    where workspace_id = :workspace_id and file_hash = :file_hash
                """), {"workspace_id": workspace_id, "file_hash": file_hash}).mappings().one()
                existing_id = cast(UUID, existing["id"])
                if existing["status"] == "failed" and existing["uploaded_by"] == user_id:
                    retried = session.execute(text("""
                        update public.imports set status = 'staged', error_code = null,
                          error_message = null, parser_version = :parser_version
                        where id = :import_id and workspace_id = :workspace_id and status = 'failed'
                          and uploaded_by = :user_id returning id
                    """), {"import_id": existing_id, "workspace_id": workspace_id,
                           "user_id": user_id, "parser_version": PARSER_VERSION}).scalar_one_or_none()
                    if retried is not None:
                        return self._summary(session, workspace_id, existing_id), False
                return self._summary(session, workspace_id, existing_id), True
            # A rejected upload rolls this reservation back, allowing an identical retry.
            upload(storage_path)
            return self._summary(session, workspace_id, import_id), False

    def mark_failed(self, user_id: UUID, import_id: UUID, code: str, message: str) -> None:
        with self._session(user_id) as session:
            workspace_id = self._workspace_id(session, user_id)
            updated = session.execute(text("""
                update public.imports set status = 'failed', error_code = :code, error_message = :message
                where id = :import_id and workspace_id = :workspace_id
                  and uploaded_by = :user_id and status = 'staged'
                returning id
            """), {"import_id": import_id, "workspace_id": workspace_id, "user_id": user_id,
                   "code": code, "message": message}).scalar_one_or_none()
            if updated is None:
                raise ImportFailure("import_state", "Import is no longer staged.", 409)

    def commit(self, user_id: UUID, import_id: UUID, workbook: ParsedWorkbook) -> ImportResult:
        if not workbook.rows:
            raise ImportFailure("no_transactions", "No transactions are available to commit.", 422)
        with self._session(user_id) as session:
            workspace_id = self._workspace_id(session, user_id)
            row = session.execute(text("""
                select id, status from public.imports
                where id = :import_id and workspace_id = :workspace_id and uploaded_by = :user_id
                for update
            """), {"import_id": import_id, "workspace_id": workspace_id, "user_id": user_id}).mappings().first()
            if row is None or row["status"] != "staged":
                raise ImportFailure("import_state", "Import is no longer staged.", 409)

            version_id = uuid4()
            session.execute(text("""
                insert into public.dataset_versions
                  (id, workspace_id, import_id, version_number, status, created_by, committed_at)
                values (:id, :workspace_id, :import_id, 1, 'committed', :user_id, now())
            """), {"id": version_id, "workspace_id": workspace_id,
                   "import_id": import_id, "user_id": user_id})

            source_params: list[dict[str, object]] = []
            transaction_params: list[dict[str, object]] = []
            for item in workbook.rows:
                source_id = uuid4()
                source_params.append({
                    "id": source_id, "version_id": version_id, "sheet_name": item.sheet_name,
                    "row_number": item.row_number, "raw_cells": json.dumps(item.raw_cells, ensure_ascii=False),
                    "parse_status": "included", "reason": None,
                })
                transaction_params.append({
                    "id": uuid4(), "workspace_id": workspace_id, "version_id": version_id,
                    "source_id": source_id, "transaction_date": item.transaction_date,
                    "description": item.description, "direction": item.direction,
                    "amount": item.amount, "category": item.category,
                })
            for excluded in workbook.excluded_rows:
                source_params.append({
                    "id": uuid4(), "version_id": version_id, "sheet_name": excluded.sheet_name,
                    "row_number": excluded.row_number, "raw_cells": json.dumps(excluded.raw_cells, ensure_ascii=False),
                    "parse_status": "excluded", "reason": excluded.reason,
                })
            source_sql = text("""
                insert into public.source_rows
                  (id, dataset_version_id, sheet_name, row_number, raw_cells, parse_status, exclusion_reason)
                values (:id, :version_id, :sheet_name, :row_number, cast(:raw_cells as jsonb),
                        :parse_status, :reason)
            """)
            transaction_sql = text("""
                insert into public.transactions
                  (id, workspace_id, dataset_version_id, source_row_id, transaction_date,
                   description, direction, amount, category)
                values (:id, :workspace_id, :version_id, :source_id, :transaction_date,
                        :description, :direction, :amount, :category)
            """)
            for start in range(0, len(source_params), 500):
                session.execute(source_sql, source_params[start:start + 500])
            for start in range(0, len(transaction_params), 500):
                session.execute(transaction_sql, transaction_params[start:start + 500])
            session.execute(text("""
                update public.imports set status = 'committed'
                where id = :import_id and workspace_id = :workspace_id and status = 'staged'
            """), {"import_id": import_id, "workspace_id": workspace_id})
            return self._summary(session, workspace_id, import_id)

    def list(self, user_id: UUID, page: int, page_size: int) -> ImportPage:
        with self._session(user_id) as session:
            workspace_id = self._workspace_id(session, user_id)
            total = session.execute(text("""
                select count(*) from public.imports where workspace_id = :workspace_id
            """), {"workspace_id": workspace_id}).scalar_one()
            ids = session.execute(text("""
                select id from public.imports where workspace_id = :workspace_id
                order by created_at desc, id desc limit :limit offset :offset
            """), {"workspace_id": workspace_id, "limit": page_size,
                   "offset": (page - 1) * page_size}).scalars().all()
            return ImportPage(tuple(self._summary(session, workspace_id, item) for item in ids),
                              page, page_size, total)

    def detail(self, user_id: UUID, import_id: UUID, page: int, page_size: int,
               focus_transaction_id: UUID | None = None) -> ImportDetail:
        with self._session(user_id) as session:
            workspace_id = self._workspace_id(session, user_id)
            summary = self._summary(session, workspace_id, import_id)
            version_id = session.execute(text("""
                select id from public.dataset_versions where import_id = :import_id
                  and workspace_id = :workspace_id and status = 'committed'
                order by version_number desc limit 1
            """), {"import_id": import_id, "workspace_id": workspace_id}).scalar_one_or_none()
            if focus_transaction_id is not None:
                offset = session.execute(text("""
                    select position from (
                      select t.id, row_number() over (order by t.transaction_date desc, t.id desc) - 1 as position
                      from public.transactions t
                      join public.dataset_versions v on v.id = t.dataset_version_id
                      where v.import_id = :import_id and t.workspace_id = :workspace_id
                    ) ranked where id = :focus_id
                """), {"import_id": import_id, "workspace_id": workspace_id,
                       "focus_id": focus_transaction_id}).scalar_one_or_none()
                if offset is None:
                    raise ImportFailure("transaction_not_found", "Source transaction not found in this import.", 404)
                page = int(offset) // page_size + 1
            rows = session.execute(text("""
                select t.id, s.sheet_name, s.row_number, t.transaction_date, t.description,
                       t.direction, t.amount, t.category
                from public.transactions t
                join public.source_rows s on s.id = t.source_row_id
                join public.dataset_versions v on v.id = t.dataset_version_id
                where v.import_id = :import_id and t.workspace_id = :workspace_id
                order by t.transaction_date desc, t.id desc limit :limit offset :offset
            """), {"import_id": import_id, "workspace_id": workspace_id,
                   "limit": page_size, "offset": (page - 1) * page_size}).mappings().all()
            transactions = tuple(TransactionRecord(
                id=row["id"], source_sheet=row["sheet_name"], source_row=row["row_number"],
                transaction_date=row["transaction_date"], description=row["description"],
                direction=cast(Direction, row["direction"]), amount=Decimal(row["amount"]),
                category=row["category"],
            ) for row in rows)
            return ImportDetail(summary, transactions, page, page_size, summary.transaction_count, version_id)


class ImportService:
    def __init__(self, repository: ImportRepository, storage: StorageGateway) -> None:
        self._repository = repository
        self._storage = storage

    def create_import(self, user_id: UUID, access_token: str, file_name: str, content: bytes,
                      proposed_hash: str | None = None) -> tuple[ImportResult, bool]:
        """Store and parse once per hash, retrying the uploader's failed row in place."""
        safe_name = file_name.replace("\\", "/").rsplit("/", 1)[-1]
        if not safe_name.lower().endswith(".xlsx") or not 1 <= len(safe_name) <= 255:
            raise ImportFailure("unsupported_file", "Choose an .xlsx workbook.", 422)
        if not content or len(content) > MAX_COMPRESSED_BYTES:
            raise ImportFailure("file_size", "The workbook must be between 1 byte and 10 MB.", 413)
        file_hash = hashlib.sha256(content).hexdigest()
        if proposed_hash is not None and proposed_hash.lower() != file_hash:
            raise ImportFailure("hash_mismatch", "The workbook hash did not match its contents.", 422)
        try:
            result, duplicate = self._repository.reserve(
                user_id, safe_name, file_hash, len(content),
                lambda path: self._storage.upload(path, content, access_token),
            )
        except SQLAlchemyError as error:
            raise ImportFailure("database_unavailable", "The import database is unavailable. Please retry.",
                                503, True) from error
        if duplicate:
            return result, True
        try:
            parsed = parse_workbook(content)
        except ParseError as error:
            try:
                self._repository.mark_failed(user_id, result.id, error.code, error.message)
            except SQLAlchemyError as database_error:
                raise ImportFailure("database_unavailable", "The import failed but its status could not be saved.",
                                    503, True, result.id) from database_error
            raise ImportFailure(error.code, error.message, 422, import_id=result.id) from error
        try:
            return self._repository.commit(user_id, result.id, parsed), False
        except SQLAlchemyError as error:
            try:
                self._repository.mark_failed(user_id, result.id, "commit_failed", "The ledger commit failed.")
            except (SQLAlchemyError, ImportFailure):
                pass  # The staged row remains visible for investigation; never expose a partial ledger.
            raise ImportFailure("database_unavailable", "The ledger commit failed. No transactions were saved.",
                                503, import_id=result.id) from error

    def list_imports(self, user_id: UUID, page: int, page_size: int) -> ImportPage:
        """Read one page of imports for the user's sole workspace."""
        try:
            return self._repository.list(user_id, page, page_size)
        except SQLAlchemyError as error:
            raise ImportFailure("database_unavailable", "The import database is unavailable.", 503, True) from error

    def get_import(self, user_id: UUID, import_id: UUID, page: int, page_size: int,
                   focus_transaction_id: UUID | None = None) -> ImportDetail:
        """Read one import and one transaction page, hiding foreign IDs as 404."""
        try:
            if focus_transaction_id is None:
                return self._repository.detail(user_id, import_id, page, page_size)
            return self._repository.detail(user_id, import_id, page, page_size, focus_transaction_id)
        except SQLAlchemyError as error:
            raise ImportFailure("database_unavailable", "The import database is unavailable.", 503, True) from error
