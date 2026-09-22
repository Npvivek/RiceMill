from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.v2.api.routes.workspaces import WorkspaceResponse
from app.v2.checkpoints import StoredCheckpoint, get_checkpoint, put_checkpoint
from app.v2.config import Settings, get_settings
from app.v2.db import get_scoped_session, runtime_engine
from app.v2.langgraph_checkpointer import ScopedLangGraphSaver
from app.v2.workspaces import WorkspaceAccess

USER_A = "d6dc7666-86c7-41b7-8e96-602efba4cb0d"
USER_B = "e59e61b8-aa95-4bc6-b25d-569354b5c754"
SPACE_A = UUID("a84e07a2-c26b-4830-95a0-eb92fd56f02d")
SPACE_B = UUID("54891ac8-d297-43c4-b654-b984cf81c92b")
RUN_A = UUID("96ae49ba-d2c3-4eac-a5ea-784aa6052271")
RUN_B = UUID("292392ce-19f1-4363-a77a-76095c5d4c7b")
CHECKPOINT_A = UUID("fc2a6a78-4c89-42d6-8f31-07ae48c6cbcd")
CHECKPOINT_B = UUID("11b41ee2-f25f-4592-93b5-35789460e49c")
SECRET = "test-secret-that-is-longer-than-32-bytes"
ISSUER = "https://project.supabase.co/auth/v1"


def token(**overrides: object) -> str:
    claims: dict[str, object] = {
        "sub": USER_A,
        "aud": "authenticated",
        "iss": ISSUER,
        "exp": datetime.now(UTC) + timedelta(minutes=5),
    }
    claims.update(overrides)
    return jwt.encode(claims, SECRET, algorithm="HS256")


class FakeResult:
    def __init__(self, row: dict[str, object] | None = None, scalar: int | None = None):
        self.row = row
        self.scalar = scalar

    def mappings(self) -> "FakeResult":
        return self

    def first(self) -> dict[str, object] | None:
        return self.row

    def __iter__(self):
        return iter([self.row] if self.row is not None else [])

    def scalar_one_or_none(self) -> int | None:
        return self.scalar


class FakeSession:
    def __init__(self):
        self.statements: list[tuple[str, dict[str, object]]] = []

    def execute(self, statement, params: dict[str, object]) -> FakeResult:
        sql = str(statement)
        self.statements.append((sql, params))
        if "select 1 from public.analysis_runs" in sql:
            allowed = params["run_id"] == RUN_A and params["workspace_id"] == SPACE_A
            return FakeResult(scalar=1 if allowed else None)
        if "from public.graph_checkpoints" in sql:
            allowed = (params["run_id"] == RUN_A and params["workspace_id"] == SPACE_A
                       and params["checkpoint_id"] == CHECKPOINT_A)
            return FakeResult(row={"id": CHECKPOINT_A, "analysis_run_id": RUN_A,
                                   "parent_checkpoint_key": None, "state": {"step": 1}} if allowed else None)
        if "from public.workspace_members" in sql:
            allowed = params["user_id"] == USER_A and params.get("workspace_id", SPACE_A) == SPACE_A
            return FakeResult(row={"id": SPACE_A, "name": "Mill", "role": "owner"} if allowed else None)
        return FakeResult()


def test_workspace_access_comes_from_jwt_and_membership_only() -> None:
    session = FakeSession()
    app.dependency_overrides[get_settings] = lambda: Settings(SUPABASE_URL="https://project.supabase.co", SUPABASE_JWT_SECRET=SECRET)
    app.dependency_overrides[get_scoped_session] = lambda: session
    client = TestClient(app)
    try:
        ok = client.get(f"/v2/workspaces/{SPACE_A}", headers={"Authorization": f"Bearer {token()}", "X-User-Id": USER_B})
        denied = client.get(f"/v2/workspaces/{SPACE_B}?user_id={USER_B}&workspace_id={SPACE_A}",
                            headers={"Authorization": f"Bearer {token()}", "X-User-Id": USER_B})
        listed = client.get(f"/v2/workspaces?user_id={USER_B}", headers={"Authorization": f"Bearer {token()}"})
    finally:
        app.dependency_overrides.clear()
    assert ok.status_code == 200
    assert WorkspaceResponse.model_validate(ok.json()).id == SPACE_A
    assert denied.status_code == 403
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [str(SPACE_A)]
    assert all(params["user_id"] == USER_A for sql, params in session.statements if "workspace_members" in sql)


def test_user_without_membership_cannot_read_a_workspace() -> None:
    session = FakeSession()
    app.dependency_overrides[get_settings] = lambda: Settings(SUPABASE_URL="https://project.supabase.co", SUPABASE_JWT_SECRET=SECRET)
    app.dependency_overrides[get_scoped_session] = lambda: session
    try:
        response = TestClient(app).get(f"/v2/workspaces/{SPACE_A}", headers={"Authorization": f"Bearer {token(sub=USER_B)}"})
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 403
    assert session.statements[0][1]["user_id"] == USER_B


@pytest.mark.parametrize("invalid", [
    {"aud": "service_role"},
    {"iss": "https://other.supabase.co/auth/v1"},
    {"exp": datetime.now(UTC) - timedelta(minutes=1)},
])
def test_signed_token_with_wrong_audience_issuer_or_expiry_is_rejected(invalid: dict[str, object]) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(SUPABASE_URL="https://project.supabase.co", SUPABASE_JWT_SECRET=SECRET)
    try:
        response = TestClient(app).get("/v2/workspaces", headers={"Authorization": f"Bearer {token(**invalid)}"})
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 401


def test_checkpoint_reads_and_writes_require_run_in_membership_workspace() -> None:
    session = FakeSession()
    access = WorkspaceAccess(id=SPACE_A, name="Mill", role="owner")
    assert get_checkpoint(session, access, RUN_A, CHECKPOINT_A).state == {"step": 1}
    assert get_checkpoint(session, access, RUN_A, CHECKPOINT_B) is None
    with pytest.raises(HTTPException) as foreign_run:
        get_checkpoint(session, access, RUN_B, CHECKPOINT_B)
    assert foreign_run.value.status_code == 403
    before = len(session.statements)
    with pytest.raises(HTTPException) as foreign_write:
        put_checkpoint(session, access, RUN_B, {"step": 2})
    assert foreign_write.value.status_code == 403
    assert not any("insert into public.graph_checkpoints" in sql for sql, _ in session.statements[before:])
    with pytest.raises(HTTPException) as foreign_parent:
        put_checkpoint(session, access, RUN_A, {"step": 2}, CHECKPOINT_B)
    assert foreign_parent.value.status_code == 403
    written = put_checkpoint(session, access, RUN_A, {"step": 2}, CHECKPOINT_A)
    assert written.id not in {CHECKPOINT_A, CHECKPOINT_B}
    assert written.parent_checkpoint_key == str(CHECKPOINT_A)


def test_langgraph_saver_rejects_foreign_thread_on_every_entry_point() -> None:
    saver = ScopedLangGraphSaver(FakeSession(), WorkspaceAccess(SPACE_A, "Mill", "owner"), RUN_A)
    foreign = {"configurable": {"thread_id": str(RUN_B), "checkpoint_ns": ""}}
    with pytest.raises(HTTPException) as read:
        saver.get_tuple(foreign)
    with pytest.raises(HTTPException) as write:
        saver.put(foreign, {"id": "server-generated", "channel_values": {}}, {}, {})
    with pytest.raises(HTTPException) as pending:
        saver.put_writes(foreign, [("channel", 1)], "task")
    with pytest.raises(HTTPException) as listing:
        list(saver.list(foreign))
    assert {read.value.status_code, write.value.status_code,
            pending.value.status_code, listing.value.status_code} == {403}


def test_langgraph_saver_round_trips_a_scoped_checkpoint(monkeypatch) -> None:
    import app.v2.langgraph_checkpointer as module

    saved: dict[UUID, StoredCheckpoint] = {}

    def save(_session, _workspace, run_id, state, parent_checkpoint_id=None):
        record = StoredCheckpoint(uuid4(), run_id,
                                  str(parent_checkpoint_id) if parent_checkpoint_id else None, state)
        saved[record.id] = record
        return record

    monkeypatch.setattr(module, "require_run_access", lambda *_args: None)
    monkeypatch.setattr(module, "put_checkpoint", save)
    monkeypatch.setattr(module, "get_checkpoint", lambda _s, _w, _r, checkpoint_id: saved.get(checkpoint_id))
    saver = ScopedLangGraphSaver(FakeSession(), WorkspaceAccess(SPACE_A, "Mill", "owner"), RUN_A)
    config = {"configurable": {"thread_id": str(RUN_A), "checkpoint_ns": ""}}
    checkpoint = {"v": 1, "id": "internal", "ts": "now", "channel_values": {"count": 2},
                  "channel_versions": {}, "versions_seen": {}}
    written_config = saver.put(config, checkpoint, {"source": "input", "step": 1}, {})
    loaded = saver.get_tuple(written_config)
    assert loaded is not None
    assert loaded.checkpoint["channel_values"] == {"count": 2}
    assert loaded.checkpoint["id"] == written_config["configurable"]["checkpoint_id"]
    assert loaded.metadata["source"] == "input"


@pytest.mark.parametrize("url", [
    "postgresql+psycopg://postgres:secret@db.local:5432/postgres",
    "postgresql+psycopg://service_role:secret@db.local:5432/postgres",
    "sqlite:///test.db",
])
def test_runtime_engine_rejects_privileged_or_wrong_dialect_urls(url: str) -> None:
    with pytest.raises(ValueError):
        runtime_engine(url, "development")
