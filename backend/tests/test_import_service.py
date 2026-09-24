"""Service behavior uses in-memory adapters; SQL commit rollback uses a fake session."""

import hashlib
from contextlib import contextmanager
from dataclasses import replace
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy.exc import OperationalError

import app.v2.imports.service as service_module
from app.v2.imports.models import ImportFailure, ImportResult
from app.v2.imports.service import ImportService, PostgresImportRepository
from tests.test_import_parser import workbook_bytes

USER = UUID("a84e07a2-c26b-4830-95a0-eb92fd56f02d")
WORKSPACE = UUID("54891ac8-d297-43c4-b654-b984cf81c92b")


def result(import_id: UUID, status: str = "staged") -> ImportResult:
    return ImportResult(import_id, "book.xlsx", status, 0, 0, Decimal("0"), Decimal("0"), datetime.now(UTC))  # type: ignore[arg-type]


class MemoryRepository:
    def __init__(self) -> None:
        self.records: dict[str, ImportResult] = {}
        self.uploaders: dict[str, UUID] = {}
        self.failed: list[tuple[UUID, str]] = []
        self.commit_calls = 0

    def reserve(self, user: UUID, _name: str, file_hash: str, _size: int, upload) -> tuple[ImportResult, bool]:
        if file_hash in self.records:
            existing = self.records[file_hash]
            if existing.status == "failed" and self.uploaders[file_hash] == user:
                retried = replace(existing, status="staged", error_code=None, error_message=None)
                self.records[file_hash] = retried
                return retried, False
            return existing, True
        new = result(uuid4())
        upload(f"{WORKSPACE}/{new.id}.xlsx")
        self.records[file_hash] = new
        self.uploaders[file_hash] = user
        return new, False

    def mark_failed(self, _user: UUID, import_id: UUID, code: str, message: str) -> None:
        self.failed.append((import_id, code))
        for key, value in self.records.items():
            if value.id == import_id:
                self.records[key] = replace(value, status="failed", error_code=code, error_message=message)
                break

    def commit(self, _user: UUID, import_id: UUID, workbook) -> ImportResult:
        self.commit_calls += 1
        committed = ImportResult(import_id, "book.xlsx", "committed", len(workbook.rows), len(workbook.rows),
                                 workbook.income_total, workbook.expense_total, datetime.now(UTC))
        for key, value in self.records.items():
            if value.id == import_id:
                self.records[key] = committed
                break
        return committed


class MemoryStorage:
    def __init__(self, fail: bool = False) -> None:
        self.calls = 0
        self.fail = fail

    def upload(self, _path: str, _content: bytes, _token: str) -> None:
        self.calls += 1
        if self.fail:
            raise ImportFailure("storage_unavailable", "Storage unavailable.", 503, True)


def valid_bytes() -> bytes:
    return workbook_bytes("Income", [["Date", "Description", "Amount"],
                                     ["01/09/2026", "Rice sale", "12.50"]])


def test_same_hash_returns_existing_without_second_upload_or_commit() -> None:
    repository, storage = MemoryRepository(), MemoryStorage()
    service = ImportService(repository, storage)
    first, duplicate_first = service.create_import(USER, "token", "book.xlsx", valid_bytes())
    second, duplicate_second = service.create_import(USER, "token", "book.xlsx", valid_bytes())
    assert (duplicate_first, duplicate_second) == (False, True)
    assert first.id == second.id
    assert len(repository.records) == storage.calls == repository.commit_calls == 1


def test_storage_failure_rolls_back_reservation_and_allows_retry() -> None:
    repository, storage = MemoryRepository(), MemoryStorage(fail=True)
    service = ImportService(repository, storage)
    with pytest.raises(ImportFailure) as error:
        service.create_import(USER, "token", "book.xlsx", valid_bytes())
    assert error.value.code == "storage_unavailable"
    assert repository.records == {}
    storage.fail = False
    imported, duplicate = service.create_import(USER, "token", "book.xlsx", valid_bytes())
    assert imported.status == "committed" and not duplicate


def test_import_commits_valid_rows_when_other_rows_are_excluded() -> None:
    repository = MemoryRepository()
    service = ImportService(repository, MemoryStorage())
    workbook = workbook_bytes("Income", [
        ["Date", "Description", "Amount"],
        ["31/02/2026", "Bad date", "10.00"],
        ["01/09/2026", "Rice sale", "12.50"],
        ["02/09/2026", "Transport advance", None],
    ])
    imported, duplicate = service.create_import(USER, "token", "book.xlsx", workbook)
    assert imported.status == "committed" and not duplicate
    assert imported.transaction_count == 1
    assert imported.income_total == Decimal("12.50")
    assert repository.failed == []
    assert repository.commit_calls == 1


def test_no_valid_transactions_marks_import_failed_without_ledger_commit() -> None:
    repository = MemoryRepository()
    service = ImportService(repository, MemoryStorage())
    invalid = workbook_bytes("Income", [["Date", "Description", "Amount"],
                                        ["31/02/2026", "Rice sale", "10.00"]])
    with pytest.raises(ImportFailure) as error:
        service.create_import(USER, "token", "book.xlsx", invalid)
    assert error.value.status_code == 422
    assert error.value.import_id == repository.failed[0][0]
    assert repository.failed[0][1] == "no_transactions"
    assert repository.commit_calls == 0


def test_same_hash_failed_import_retries_without_another_row_or_upload() -> None:
    repository, storage = MemoryRepository(), MemoryStorage()
    content = valid_bytes()
    staged, duplicate = repository.reserve(
        USER, "book.xlsx", hashlib.sha256(content).hexdigest(), len(content),
        lambda path: storage.upload(path, content, "token"),
    )
    assert not duplicate
    repository.mark_failed(USER, staged.id, "invalid_date", "Old parser rejected the workbook.")
    other_result, other_duplicate = repository.reserve(
        uuid4(), "book.xlsx", hashlib.sha256(content).hexdigest(), len(content),
        lambda _path: pytest.fail("another uploader must not replace the stored workbook"),
    )
    assert other_duplicate and other_result.status == "failed"

    imported, duplicate = ImportService(repository, storage).create_import(USER, "token", "book.xlsx", content)

    assert imported.id == staged.id and imported.status == "committed" and not duplicate
    assert len(repository.records) == storage.calls == repository.commit_calls == 1


def test_hash_hint_mismatch_rejected_before_storage() -> None:
    storage = MemoryStorage()
    service = ImportService(MemoryRepository(), storage)
    with pytest.raises(ImportFailure) as error:
        service.create_import(USER, "token", "book.xlsx", valid_bytes(), "0" * 64)
    assert error.value.code == "hash_mismatch"
    assert storage.calls == 0


class FakeResult:
    def __init__(self, value=None) -> None:
        self.value = value

    def scalars(self):
        return self

    def all(self):
        return [WORKSPACE]

    def mappings(self):
        return self

    def first(self):
        return self.value


class FakeSession:
    def __init__(self, _engine) -> None:
        self.statements: list[str] = []
        self.rolled_back = False
        self.committed = False

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    @contextmanager
    def begin(self):
        try:
            yield self
        except Exception:
            self.rolled_back = True
            raise
        else:
            self.committed = True

    def execute(self, statement, _params=None):
        sql = str(statement)
        self.statements.append(sql)
        if "for update" in sql:
            return FakeResult({"id": uuid4(), "status": "staged"})
        if "insert into public.source_rows" in sql:
            raise OperationalError("insert source", {}, Exception("simulated mid-transaction failure"))
        return FakeResult()


def test_mid_commit_sql_failure_rolls_back_version_and_all_rows(monkeypatch) -> None:
    sessions: list[FakeSession] = []

    def session_factory(engine):
        session = FakeSession(engine)
        sessions.append(session)
        return session

    monkeypatch.setattr(service_module, "Session", session_factory)
    from app.v2.imports.parser import parse_workbook

    with pytest.raises(OperationalError):
        PostgresImportRepository(object()).commit(USER, uuid4(), parse_workbook(valid_bytes()))  # type: ignore[arg-type]
    session = sessions[0]
    assert session.rolled_back and not session.committed
    assert any("insert into public.dataset_versions" in sql for sql in session.statements)
    assert any("insert into public.source_rows" in sql for sql in session.statements)
    assert not any("insert into public.transactions" in sql for sql in session.statements)
    assert not any("set status = 'committed'" in sql for sql in session.statements)
