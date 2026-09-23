from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.v2.ai.service import AnalysisFailure
from app.v2.api.routes.analysis import get_analysis_service
from app.v2.auth import AuthenticatedUser, get_current_user

USER = uuid4()
VERSION = uuid4()
RUN = uuid4()


def record(status="completed", attempts=1):
    return {"id": RUN, "dataset_version_id": VERSION, "status": status, "stage": status,
            "attempt_count": attempts, "active_lease_until": None, "error_code": None,
            "error_message": None, "started_at": datetime.now(UTC),
            "completed_at": datetime.now(UTC), "created_at": datetime.now(UTC),
            "findings": [], "tool_calls": []}


class FakeRepository:
    def get(self, user_id: UUID, run_id: UUID):
        if user_id != USER or run_id != RUN:
            raise AnalysisFailure("run_not_found", "Analysis run not found.", 404)
        return record()

    def list(self, user_id: UUID, version_id: UUID, page: int, page_size: int):
        if user_id != USER or version_id != VERSION:
            raise AnalysisFailure("version_not_found", "Committed dataset not found.", 404)
        return {"items": [record()], "page": page, "page_size": page_size, "total": 1}

    def cancel(self, user_id: UUID, run_id: UUID):
        self.get(user_id, run_id)
        return record("cancelled")


class FakeService:
    def __init__(self):
        self.repository = FakeRepository()
        self.executed = []

    def create(self, user_id: UUID, version_id: UUID):
        if user_id != USER or version_id != VERSION:
            raise AnalysisFailure("version_not_found", "Committed dataset not found.", 404)
        return record("queued"), True

    def execute(self, user_id: UUID, run_id: UUID):
        self.executed.append((user_id, run_id))


class ExhaustedService(FakeService):
    def create(self, user_id: UUID, version_id: UUID):
        return record("failed", 3), False


def test_all_four_analysis_routes_and_background_schedule():
    service = FakeService()
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(str(USER), None)
    app.dependency_overrides[get_analysis_service] = lambda: service
    try:
        client = TestClient(app)
        created = client.post(f"/v2/datasets/{VERSION}/analysis-runs")
        assert created.status_code == 202
        assert created.json()["status"] == "queued"
        assert service.executed == [(USER, RUN)]
        detail = client.get(f"/v2/analysis-runs/{RUN}")
        assert detail.status_code == 200 and detail.json()["id"] == str(RUN)
        page = client.get(f"/v2/analysis-runs?dataset_version_id={VERSION}&page=2&page_size=10")
        assert page.status_code == 200 and page.json()["page"] == 2
        cancelled = client.post(f"/v2/analysis-runs/{RUN}/cancel")
        assert cancelled.status_code == 200 and cancelled.json()["status"] == "cancelled"
        assert client.get(f"/v2/analysis-runs/{uuid4()}").status_code == 404
        assert client.post(f"/v2/datasets/{uuid4()}/analysis-runs").status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_create_refuses_exhausted_retries():
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(str(USER), None)
    app.dependency_overrides[get_analysis_service] = lambda: ExhaustedService()
    try:
        response = TestClient(app).post(f"/v2/datasets/{VERSION}/analysis-runs")
        assert response.status_code == 409
        assert response.json()["detail"]["code"] == "retry_exhausted"
    finally:
        app.dependency_overrides.clear()
