"""Each import route returns the declared HTTP contract without a live database."""

from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.v2.api.routes.imports import get_import_service
from app.v2.auth import AuthenticatedUser, get_current_user
from app.v2.imports.models import ImportDetail, ImportPage, ImportResult, TransactionRecord
from tests.test_import_parser import workbook_bytes

USER = uuid4()
IMPORT = uuid4()
TRANSACTION = uuid4()


def record() -> ImportResult:
    return ImportResult(IMPORT, "book.xlsx", "committed", 2, 1, Decimal("12.50"), Decimal("0.00"),
                        datetime.now(UTC))


class FakeService:
    def __init__(self) -> None:
        self.user_ids = []

    def create_import(self, user_id, token, name, content, proposed_hash=None):
        self.user_ids.append(user_id)
        assert token == "session-token" and name == "book.xlsx"
        assert content and proposed_hash is None
        return record(), False

    def list_imports(self, user_id, page, page_size):
        self.user_ids.append(user_id)
        return ImportPage((record(),), page, page_size, 1)

    def get_import(self, user_id, import_id, page, page_size):
        self.user_ids.append(user_id)
        assert import_id == IMPORT
        transaction = TransactionRecord(TRANSACTION, "Income", 2, date(2026, 9, 1),
                                        "Rice sale", "income", Decimal("12.50"), "Other income")
        return ImportDetail(record(), (transaction,), page, page_size, 1)


def client_for(service: FakeService) -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(str(USER), None)
    app.dependency_overrides[get_import_service] = lambda: service
    return TestClient(app)


def test_post_import_returns_created_summary() -> None:
    service = FakeService()
    try:
        response = client_for(service).post(
            "/v2/imports", files={"file": ("book.xlsx", workbook_bytes("Income", [
                ["Date", "Description", "Amount"], ["01/09/2026", "Rice sale", "12.50"],
            ]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers={"Authorization": "Bearer session-token"},
        )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 201
    assert response.json()["id"] == str(IMPORT)
    assert response.json()["income_total"] == "12.50"
    assert service.user_ids == [USER]


def test_get_imports_returns_paginated_list() -> None:
    service = FakeService()
    try:
        response = client_for(service).get("/v2/imports?page=2&page_size=10")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["page"] == 2
    assert response.json()["items"][0]["id"] == str(IMPORT)
    assert service.user_ids == [USER]


def test_get_import_returns_paginated_transactions() -> None:
    service = FakeService()
    try:
        response = client_for(service).get(f"/v2/imports/{IMPORT}?page=1&page_size=5")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["transactions"][0]["amount"] == "12.50"
    assert response.json()["import_record"]["id"] == str(IMPORT)
    assert service.user_ids == [USER]
