from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.v2.ai.conversations import ConversationFailure
from app.v2.api.routes.conversations import get_conversation_service
from app.v2.auth import AuthenticatedUser, get_current_user

USER = uuid4()
OTHER = uuid4()
VERSION = uuid4()
THREAD = uuid4()


class FakeService:
    def __init__(self) -> None:
        self.calls: list[tuple] = []

    def _record(self, user_id: UUID, thread_id: UUID) -> dict:
        if user_id != USER or thread_id != THREAD:
            raise ConversationFailure("thread_not_found", "Conversation not found.", 404)
        return {"id": THREAD, "dataset_version_id": VERSION, "mode": "chat",
                "created_at": datetime.now(UTC), "messages": [{"id": uuid4(),
                "author_type": "assistant", "content": "Verified.", "segments": [{"text": "Verified."}],
                "response_kind": "normal", "created_at": datetime.now(UTC)}]}

    def create(self, user_id: UUID, version_id: UUID, mode: str) -> dict:
        self.calls.append(("create", user_id, version_id, mode))
        if user_id != USER or version_id != VERSION:
            raise ConversationFailure("version_not_found", "Dataset not found.", 404)
        return self._record(user_id, THREAD)

    def post(self, user_id: UUID, thread_id: UUID, content: str) -> dict:
        self.calls.append(("post", user_id, thread_id, content))
        return self._record(user_id, thread_id)

    def get(self, user_id: UUID, thread_id: UUID) -> dict:
        self.calls.append(("get", user_id, thread_id))
        return self._record(user_id, thread_id)

    def static_findings(self, user_id: UUID, version_id: UUID) -> list:
        return []


def test_create_send_and_read_use_only_verified_subject() -> None:
    service = FakeService()
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(str(USER), None)
    app.dependency_overrides[get_conversation_service] = lambda: service
    try:
        client = TestClient(app)
        created = client.post("/v2/conversations", json={"dataset_version_id": str(VERSION), "mode": "chat"})
        assert created.status_code == 201
        sent = client.post(f"/v2/conversations/{THREAD}/messages", json={"content": "  Why?  "})
        assert sent.status_code == 200
        assert ("post", USER, THREAD, "Why?") in service.calls
        assert client.get(f"/v2/conversations/{THREAD}").status_code == 200
        assert client.get(f"/v2/conversations/{uuid4()}").status_code == 404
        assert client.post(f"/v2/conversations/{THREAD}/messages", json={"content": " "}).status_code == 422
        assert client.post("/v2/conversations", json={"dataset_version_id": str(VERSION),
            "mode": "chat", "user_id": str(OTHER)}).status_code == 422
        assert client.post("/v2/conversations", json={"dataset_version_id": str(VERSION),
            "mode": "chat", "workspace_id": str(uuid4())}).status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_foreign_subject_cannot_read_or_write_thread() -> None:
    service = FakeService()
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(str(OTHER), None)
    app.dependency_overrides[get_conversation_service] = lambda: service
    try:
        client = TestClient(app)
        assert client.get(f"/v2/conversations/{THREAD}").status_code == 404
        assert client.post(f"/v2/conversations/{THREAD}/messages", json={"content": "Question"}).status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_missing_token_is_rejected_before_service() -> None:
    app.dependency_overrides[get_conversation_service] = lambda: FakeService()
    try:
        assert TestClient(app).get(f"/v2/conversations/{THREAD}").status_code == 401
    finally:
        app.dependency_overrides.clear()
